import { compileCode } from "./compiler";

var argv = require("minimist")(process.argv.slice(2));

const importAlias = argv.i ?? argv.d;

/**
 * Flatten keys for flat object ITranslations
 */
interface ITranslationsInput {
    [key: string]: ITranslationsInput | string | number;
}
type ITranslationStore = Record<string, { params: string; code: string }>;

const flattenObjectKeys = (data: ITranslationsInput, prefix: string): ITranslationStore => {
    let table = {} as ITranslationStore;
    const keys = Object.keys(data);
    const count = keys.length;

    for (let i = 0; i < count; ++i) {
        const key = keys[i];
        const prefixKey = prefix + key;

        if (typeof data[key] === "object") {
            table = Object.assign(table, flattenObjectKeys(data[key] as ITranslationsInput, prefixKey + "."));
        } else {
            table[prefixKey] = compileCode(data[key] as string);
        }
    }
    return table;
};

for (const lang of argv.l) {
    const file = argv.d + "/" + lang.toLowerCase();
    var fs = require("fs");

    const rawData = fs.readFileSync(file + ".json", "utf8");

    // console.debug(rawData);

    const jsonData = JSON.parse(rawData);

    const PropsPerKey = [] as string[];
    let content = `export const translate = (...p: Props): string => {\n`;
    content += `\tswitch (p[0]) {\n`;

    const flattenLang = flattenObjectKeys(jsonData, "");

    for (const f in flattenLang) {
        const params = flattenLang[f].params;
        let fReturn = `return ${flattenLang[f].code}`;
        if (params.length > 0) {
            PropsPerKey.push(`[k: "${f}", ${params}]`);
            fReturn = `{
                    const [, v] = p
                    return ${flattenLang[f].code}
                }`;
        } else PropsPerKey.push(`[k: "${f}"]`);

        content += `\t\tcase "${f}": ${fReturn}\n`;
    }

    // default value
    content += `\t\tdefault: return \`MISSING \${p[0]}\`\n`;

    content += `\t}\n`;
    content += `}\n`;

    let propTypes = `export type Props = ${PropsPerKey.join(`\n | `)}\n`;

    fs.writeFileSync(file + ".ts", propTypes + content);
}

// Context

let content = `import { useReducer, createContext, ReactNode, useContext } from "react";\n\n`;
const PropTypes = [] as string[];
for (const lang of argv.l) {
    content += `import { Props as Props${lang.toUpperCase()} } from "${importAlias}${lang.toLowerCase()}";\n`;
    PropTypes.push(`Props${lang.toUpperCase()}`);
}

content += `\nexport type TranslationProps = ${PropTypes.join(" | ")};\n`;

content += `interface IState {\n`;
content += `    lang?: string;\n`;
content += `    translation?: (...p: TranslationProps) => string;\n`;
content += `}\n`;

content += `enum ACTIONTYPE {\n`;
content += `    CHANGE_LANG = "CHANGE_LANG",\n`;
content += `}\n`;

content += `type ACTION = { type: ACTIONTYPE.CHANGE_LANG; payload: { lang: string; translation: (...p: TranslationProps) => string } };\n`;

content += `interface IContextProps {\n`;
content += `    state: IState;\n`;
content += `    dispatch: (action: ACTION) => void;\n`;
content += `}\n`;

content += `const TranslationContext = createContext<IContextProps>({} as IContextProps);\n`;

content += `function reducer(state: IState, action: ACTION) {\n`;
content += `    switch (action.type) {\n`;
content += `        case ACTIONTYPE.CHANGE_LANG:\n`;
content += `            return {\n`;
content += `                ...state,\n`;
content += `                lang: action.payload.lang,\n`;
content += `                translation: action.payload.translation,\n`;
content += `            };\n`;
content += `        default:\n`;
content += `            return state;\n`;
content += `    }\n`;
content += `}\n`;

content += `export const TranslationProvider = ({ children }: { children: ReactNode }): JSX.Element => {\n`;
content += `    const [state, dispatch] = useReducer(reducer, {});\n`;
content += `    return <TranslationContext.Provider value={{ state, dispatch }}>{children}</TranslationContext.Provider>;\n`;
content += `};\n`;

content += `export const useTranslation = (): {t: (...p: TranslationProps) => string; set: (lang: string) => void; language?: string} => {\n`;
content += `    const {state, dispatch} = useContext(TranslationContext)\n`;
content += `    return {\n`;
content += `        t: (...p: TranslationProps): string => {\n`;
content += `            return state.translation ? state.translation(...p) : \`\`\n`;
content += `        },\n`;
content += `        set: (lang: string): void => {\n`;
content += `            if (state.lang === lang) return\n`;
content += `            switch (lang) {\n`;

for (const lang of argv.l) {
    content += `            case "${lang.toLowerCase()}":\n`;
    content += `                import(\`${importAlias}${lang.toLowerCase()}.ts\`).then((module) => dispatch({ type: ACTIONTYPE.CHANGE_LANG, payload: { lang, translation: module.translate } }));\n`;
    content += `                break;\n`;
}

content += `            }\n`;
content += `        },\n`;
content += `        language: state.lang,\n`;
content += `    }\n`;
content += `}\n`;

fs.writeFileSync(argv.d + "/TranslationContext.tsx", content);
