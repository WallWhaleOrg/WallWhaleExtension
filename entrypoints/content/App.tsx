import { HoverCardDemo } from "@/components/main/HoverDemo"
import { ResizableDemo } from "@/components/main/ResizableDemo"
import { TabsDemo } from "@/components/main/TabsDemo"
import { TooltipDemo } from "@/components/main/TooltipDemo"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"


export default function App() {
    return (
        <div
            className="fixed top-2 min-h-[400px] right-2 min-w-[400px] bg-background z-[9999451] rounded-lg flex justify-center items-center p-4">
            {/* <ScrollArea className="w-full h-[350px] mx-auto items-center flex justify-center"> */}
                <div className='grid grid-cols-1 gap-4 items-center w-full'>
                    {/* <Button>
                        Click Me
                    </Button>
                    <TooltipDemo /> */}
                    {/* <HoverCardDemo /> */}
                    <TabsDemo />
                    {/* <ResizableDemo /> */}
                </div>
            {/* </ScrollArea> */}
        </div>
    )
};
