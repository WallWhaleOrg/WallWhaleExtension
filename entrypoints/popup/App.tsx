import { HoverCardDemo } from "@/components/main/HoverDemo"
import { ResizableDemo } from "@/components/main/ResizableDemo"
import { TabsDemo } from "@/components/main/TabsDemo"
import { TooltipDemo } from "@/components/main/TooltipDemo"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ThemeProvider } from "@/components/ui/theme-provider"


export default function App() {
    return (
        <div className="min-h-[600px] min-w-[30em] bg-background rounded-lg flex justify-center items-center p-4">
            <div className='grid grid-cols-1 gap-4 items-center w-full'>
                <ThemeProvider defaultTheme="dark">
                    {/* <Button>
                        Click Me
                    </Button>
                    <TooltipDemo /> */}
                    {/* <HoverCardDemo /> */}
                    <TabsDemo />
                    {/* <ResizableDemo /> */}
                </ThemeProvider>
            </div>
        </div>
    )
};