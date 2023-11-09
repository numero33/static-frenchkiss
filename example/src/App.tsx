import { TranslationProvider } from "@i18n/TranslationContext";
import First from "./First";
import Second from "./Second";

function App() {
    return (
        <>
            <TranslationProvider>
                <First />
                <Second />
            </TranslationProvider>
        </>
    );
}

export default App;
