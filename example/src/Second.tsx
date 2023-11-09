import { useSet } from "@i18n/TranslationContext";

export default function Second() {
    // console.debug("translation", translation);
    // import(`@i18n/de.json`).then((module) => {
    //     set("de", module);
    // });

    // set("de");

    const set = useSet();

    return (
        <div>
            Second
            <button
                onClick={() => {
                    console.time("test");
                    set("de");
                    console.timeEnd("test");
                }}
            >
                DE
            </button>
            <button
                onClick={() => {
                    console.time("test");
                    set("en");
                    console.timeEnd("test");
                }}
            >
                EN
            </button>
        </div>
    );
}
