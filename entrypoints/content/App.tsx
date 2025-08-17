import { DownloadUi } from "@/components/main/DownloadUI"
import { ThemeProvider } from "@/components/ui/theme-provider"


export default function App() {
    return (
        <div
            className=" top-2 min-h-[400px] right-2 min-w-[400px] bg-background z-[9999451] rounded-lg flex justify-center items-center p-4">
            {/* <ScrollArea className="w-full h-[350px] mx-auto items-center flex justify-center"> */}
            <div className='grid grid-cols-1 gap-4 items-center w-full'>
                {/* <Button>
                        Click Me
                    </Button>
                    <TooltipDemo /> */}
                {/* <HoverCardDemo /> */}
                <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                    <DownloadUi />

                </ThemeProvider>
                {/* <ResizableDemo /> */}
            </div>
            {/* </ScrollArea> */}
        </div>
    )
};