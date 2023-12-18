import { useReducer, createContext, ReactNode, useContext, useMemo } from "react";

import { Props as PropsDE } from "@i18n/de";
import { Props as PropsEN } from "@i18n/en";

export type TranslationProps = PropsDE | PropsEN;

interface IState {
    lang?: string;
    translation?: (...p: TranslationProps) => string;
}
enum ACTIONTYPE {
    CHANGE_LANG = "CHANGE_LANG",
}
type ACTION = { type: ACTIONTYPE.CHANGE_LANG; payload: { lang: string; translation: (...p: TranslationProps) => string } };
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
export const TranslationProvider = ({ children }: { children: ReactNode }): JSX.Element => {
    const [state, dispatch] = useReducer(reducer, {});
    return <TranslationContext.Provider value={{ state, dispatch }}>{children}</TranslationContext.Provider>;
};
export const useTranslation = (): {t: (...p: TranslationProps) => string; set: (lang: string) => void; language?: string} => {
    const {state, dispatch} = useContext(TranslationContext)
    return useMemo(
        () => ({
            t: (...p: TranslationProps): string => {
                return state.translation ? state.translation(...p) : ``;
            },
            set: (lang: string): void => {
                if (state.lang === lang) return
                switch (lang) {

                case "de":
                    import(`@i18n/de.ts`).then((module) => dispatch({ type: ACTIONTYPE.CHANGE_LANG, payload: { lang, translation: module.translate } }));
                    break;
                case "en":
                    import(`@i18n/en.ts`).then((module) => dispatch({ type: ACTIONTYPE.CHANGE_LANG, payload: { lang, translation: module.translate } }));
                    break;
                }
            },
            language: state.lang,
        }), [state, dispatch]);
}
