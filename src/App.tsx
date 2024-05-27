import { Box, Theme } from "@radix-ui/themes"
import MainScreen from "./MainScreen"
import { useIsDarkMode } from "./useIsDarkMode"

export default function App() {
    const isDarkMode = useIsDarkMode()
    return (
        <Theme appearance={isDarkMode ? "dark" : "light"} style={{ minHeight: "unset" }}>
            <Box width="400px">
                <MainScreen />
            </Box>
        </Theme>
    )
}
