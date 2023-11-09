import { t } from "@i18n/TranslationContext";
import { useState } from "react";

export default function First() {
    const [count, setCount] = useState(0);
    return (
        <>
            <div>First {t("address.fields.phone")}</div>
            <div>{t("affe", { affe: String(count) })}</div>
            <button onClick={() => setCount((x) => x + 1)}>+</button>
        </>
    );
}
