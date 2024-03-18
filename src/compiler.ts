// Block type enum
enum TYPE {
    TEXT = 0,
    VARIABLE = 1,
    EXPRESSION = 2,
}

type PartString = {type: TYPE.TEXT; value: string}
type PartVariable = {type: TYPE.VARIABLE; value: string}
type PartExpression = {type: TYPE.EXPRESSION; defaultValue: Part[]; variable: string; cases: ExpressionCase[]}
type ExpressionCase = {value: string | "other"; parts: Part[]}

type Part = PartString | PartVariable | PartExpression

// Helpers to parse ICU patterns
const VARIABLE_REGEXP = /^\s*\w+\s*$/
const EXPRESSION_REGEXP = /^\s*(\w+)\s*,\s*(select)\s*,/i

/**
 * Helper to escape text avoiding XSS
 */
// const escapeText = JSON.stringify; // (text) => '"' + text.replace(/(["\\])/g, '\\$1').replace(/[\n\r]/g, '\\n') + '"';

/**
 * Helper to bind variable name to value.
 * Default to onMissingVariable returns if not defined
 *
 * Mapping :
 * - undefined -> ''
 * - null -> ''
 * - 0 -> 0
 * - 155 -> 155
 * - 'test' -> 'test'
 * - not defined -> onMissingVariable(value, key, language)
 */
const escapeVariable = (text: string): string =>
    // prettier-ignore
    `\${v?.${text}??""}`

/**
 * Compile the translation to executable optimized function
 */
export function compileCode(text: string): {params: string; code: string} {
    const parts = parseBlocks(text)

    // simple text
    // if (parts.length === 1) {
    //     const part = parts.at(0);
    //     if (part && part.type === TYPE.TEXT) return `const ${fnName} = () => \`${part.value}\``;
    // }

    const {code, variables} = generateCode(parts)

    // variable types
    const variableTS = variables.reduce((prev, curr) => [...prev, `${curr}: string`], []).join(`; `)

    let variableParams = ""
    if (variables.length > 0) variableParams = `v:{${variableTS}}`

    return {
        params: variableParams,
        code,
    }

    // return String(
    //     new Function(
    //         "a", // params
    //         "f", // plural category function
    //         "k", // key
    //         "l", // language
    //         "v", // missingVariableHandler
    //         `var p=a||{}${size ? `,m=f?{${pluralCode.join(`,`)}}:{}` : ``};return ${code}`
    //     )
    // );
}
/**
 * Generate code to evaluate blocks
 */
function generateCode(parts: Part[]): {code: string; variables: string[]} {
    const codes = []
    const size = parts.length

    let variables: string[] = []

    for (let i = 0; i < size; ++i) {
        const p = parts[i]
        // const value = p[1]

        let code = ""

        switch (p.type) {
            case TYPE.TEXT:
                code = p.value
                break
            case TYPE.VARIABLE:
                const vName = p.value.trim()
                code = escapeVariable(vName)
                variables = [...variables, vName]
                break
            case TYPE.EXPRESSION:
                const cases = p.cases

                code += `\${(`

                // Generate ternary check
                for (const c of cases) {
                    // SELECT mode, direct assignement check
                    code += `v.${p.variable}===\`${String(c.value)}\``

                    const {code: caseCode, variables: caseVariables} = generateCode(c.parts)
                    variables = [...variables, p.variable, ...caseVariables]
                    code += `?${caseCode}:`
                }

                // Add default value

                const {code: defaultCode, variables: defaultVariables} = generateCode(p.defaultValue)
                variables = [...variables, ...defaultVariables]
                code = `${code}${defaultCode})}`
        }

        if (code) {
            codes.push(code)
        }
    }

    let returnCode = "``"
    if (codes.length > 0) returnCode = `\`${codes.join("")}\``

    return {code: returnCode, variables: [...new Set(variables)]}
}

/**
 * Helper to break patterns into blocks, allowing to extract texts,
 * variables and expressions and also blocks in expressions
 */
function parseBlocks(text: string): Part[] {
    let stackSize = 0
    let fragment = ""
    const blocks: Part[] = []

    for (let i = 0; i < text.length; ++i) {
        const c = text[i]
        let code: Part | undefined

        if (c === "{") {
            if (!stackSize++) code = {type: TYPE.TEXT, value: fragment}
        } else if (c === "}") {
            if (!--stackSize) {
                if (VARIABLE_REGEXP.test(fragment)) code = {type: TYPE.VARIABLE, value: fragment}
                else if (EXPRESSION_REGEXP.test(fragment)) code = parseExpression(fragment)
                else code = {type: TYPE.TEXT, value: fragment}
            }
        }

        if (code) {
            blocks.push(code)
            fragment = ""
        } else {
            fragment += c
        }
    }

    if (fragment.length > 0) blocks.push({type: TYPE.TEXT, value: fragment})

    return blocks
}

/**
 * Helper to parse expression
 * {N,plural,=0{x}=1{y}other{z}}
 * {color,select,red{x}green{y}other{z}}
 */
function parseExpression(text: string): PartExpression {
    const matches = text.match(EXPRESSION_REGEXP)
    const variable = matches?.[1] ?? ""
    const parts = parseBlocks(text.replace(EXPRESSION_REGEXP, "")) as PartString[]
    const size = parts.length
    const cases: ExpressionCase[] = []

    let defaultValue: Part[] = [{type: TYPE.TEXT, value: ""}]

    for (let i = 0; i < size - 1; ) {
        const value = parts[i++].value.trim()
        const result = parseBlocks(parts[i++].value)

        if (value === "other") defaultValue = result
        else cases.push({value, parts: result})
    }

    return {type: TYPE.EXPRESSION, defaultValue: defaultValue, variable, cases}
}
