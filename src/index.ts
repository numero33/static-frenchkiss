import {compileCode} from "./compiler"

var argv = require("minimist")(process.argv.slice(2))

const importAlias = argv.i ?? argv.d

/**
 * Flatten keys for flat object ITranslations
 */
interface ITranslationsInput {
    [key: string]: ITranslationsInput | string | number
}
type ITranslationStore = Record<string, {params: string; code: string}>

const flattenObjectKeys = (data: ITranslationsInput, prefix: string): ITranslationStore => {
    let table = {} as ITranslationStore
    const keys = Object.keys(data)
    const count = keys.length

    for (let i = 0; i < count; ++i) {
        const key = keys[i]
        const prefixKey = prefix + key

        if (typeof data[key] === "object") {
            table = Object.assign(table, flattenObjectKeys(data[key] as ITranslationsInput, prefixKey + "."))
        } else {
            table[prefixKey] = compileCode(data[key] as string)
        }
    }
    return table
}

for (const lang of argv.l) {
    const file = argv.d + "/" + lang.toLowerCase()
    var fs = require("fs")

    const rawData = fs.readFileSync(file + ".json", "utf8")

    // console.debug(rawData);

    const jsonData = JSON.parse(rawData)

    const PropsPerKey = [] as string[]
    let content = `export const translate = (...p: Props): string => {\n`
    content += `\tswitch (p[0]) {\n`

    const flattenLang = flattenObjectKeys(jsonData, "")

    for (const f in flattenLang) {
        const params = flattenLang[f].params
        let fReturn = `return ${flattenLang[f].code}`
        if (params.length > 0) {
            PropsPerKey.push(`[k: "${f}", ${params}]`)
            fReturn = `{
                    const [, v] = p
                    return ${flattenLang[f].code}
                }`
        } else PropsPerKey.push(`[k: "${f}"]`)

        content += `\t\tcase "${f}": ${fReturn}\n`
    }

    // default value
    content += `\t\tdefault: return \`MISSING \${p[0]}\`\n`

    content += `\t}\n`
    content += `}\n`

    let propTypes = `export type Props = ${PropsPerKey.join(`\n | `)}\n`

    fs.writeFileSync(file + ".ts", propTypes + content)
}

// Context

let content = `import { useReducer, createContext, useContext, useMemo, PropsWithChildren} from "react";\n\n`

const Languages: string[] = []
const PropTypes: string[] = []
const TranslateTypes: string[] = []
const IStates: string[] = []

for (const lang of argv.l) {
    const l = lang.toUpperCase()

    Languages.push(`"${lang}"`)
    TranslateTypes.push(`typeof translate${l}`)
    PropTypes.push(`Props${l}`)
    IStates.push(`
| {
    lang?: "${lang}"
    translation?: ${`typeof translate${l}`}
}  
`)

    content += `import { Props as Props${lang.toUpperCase()}, translate as translate${lang.toUpperCase()} } from "${importAlias}${lang.toLowerCase()}";\n`
}

content += `
export type Language = ${Languages.join(" | ")}
export type Translate = ${TranslateTypes.join(" | ")}
export type TranslationProps = ${PropTypes.join(" | ")};

type IState = ${IStates.join("\n")}

enum ACTIONTYPE {
    CHANGE_LANG = "CHANGE_LANG",
}
type ACTION = { type: ACTIONTYPE.CHANGE_LANG; payload: { lang: Language; translation: (...p: TranslationProps) => string } };
interface IContextProps {
    state: IState;
    dispatch: (action: ACTION) => void;
}
const TranslationContext = createContext<IContextProps>({} as IContextProps);
function reducer(state: IState, action: ACTION) {
    switch (action.type) {
        case ACTIONTYPE.CHANGE_LANG:
            return {
                ...state,
                lang: action.payload.lang,
                translation: action.payload.translation,
            };
        default:
            return state;
    }
}
export type TranslationProviderProps = {
    initialState?: IState
}
export const TranslationProvider = ({children, initialState = {}}: PropsWithChildren<TranslationProviderProps>) => {
    const [state, dispatch] = useReducer(reducer, initialState)
    return <TranslationContext.Provider value={{state, dispatch}}>{children}</TranslationContext.Provider>
}
export const useTranslation = () => {
    const {state, dispatch} = useContext(TranslationContext)
    return useMemo(
        () => ({
            t: (...p: TranslationProps): string => {
                return state.translation ? state.translation(...p) : \`\`;
            },
            set: (lang: Language): void => {
                if (state.lang === lang) return
                import(\`@/i18n/\${lang}\`).then((module: {translate: Translate}) =>
                    dispatch({type: ACTIONTYPE.CHANGE_LANG, payload: {lang, translation: module.translate}}),
                )
            },
            language: state.lang,
        }), [state, dispatch]);
}\n`

fs.writeFileSync(argv.d + "/TranslationContext.tsx", content)
