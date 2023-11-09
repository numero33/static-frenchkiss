export type Props = [k: "a"]
 | [k: "b", v:{count: string}]
export const translate = (...p: Props): string => {
	switch (p[0]) {
		case "a": return `a - DE`
		case "b": {
                    const [, v] = p
                    return `b ${v?.count??""} - DE`
                }
		default: return `MISSING ${p[0]}`
	}
}
