import { useCallback, useState } from "react"

export function useLocalStorage(key: string, initialValue: string) {
    const [value, setValue] = useState(() => localStorage.getItem(key) ?? initialValue)
    const setAndStore = useCallback(
        (value: string) => {
            setValue(value)
            localStorage.setItem(key, value)
        },
        [key],
    )
    return [value, setAndStore] as const
}
