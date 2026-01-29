import { type LucideIcon } from 'lucide-react';

interface NoteMetaRowProps {
    icon: LucideIcon;
    children: React.ReactNode;
    className?: string; // Allow additional styling if needed (e.g. mb-2)
}

export function NoteMetaRow({ icon: Icon, children, className = '' }: NoteMetaRowProps) {
    return (
        <div className={`flex gap-1.5 flex-shrink-0 items-center ${className}`}>
            <div className="w-4 flex justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {children}
        </div>
    );
}
