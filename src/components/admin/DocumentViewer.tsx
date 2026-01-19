import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, ZoomIn } from "lucide-react";

interface DocumentViewerProps {
  label: string;
  url: string | null;
}

export function DocumentViewer({ label, url }: DocumentViewerProps) {
  const [open, setOpen] = useState(false);

  if (!url) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="aspect-[4/3] bg-muted flex flex-col items-center justify-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">Not uploaded</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="overflow-hidden cursor-pointer group hover:ring-2 hover:ring-primary transition-all">
          <CardContent className="p-0 relative">
            <div className="aspect-[4/3] bg-muted">
              <img
                src={url}
                alt={label}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ZoomIn className="h-8 w-8 text-white" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <p className="text-sm font-medium text-white">{label}</p>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-4xl p-0">
        <img
          src={url}
          alt={label}
          className="w-full h-auto max-h-[80vh] object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
