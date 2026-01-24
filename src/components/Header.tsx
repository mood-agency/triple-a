interface HeaderProps {
  children?: React.ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <div className="flex justify-end items-center mb-6 flex-shrink-0 flex-1">
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
