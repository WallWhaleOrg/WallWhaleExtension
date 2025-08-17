import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Pill, PillStatus } from "../ui/shadcn-io/pill"
import { CheckCircleIcon } from "lucide-react"

export function DownloadUi() {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline">Hover</Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Add to library</p>
                    <Pill>
                        <PillStatus>
                            <CheckCircleIcon className="text-emerald-500" size={12} />
                            Passed
                        </PillStatus>
                        Approval Status
                    </Pill>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
