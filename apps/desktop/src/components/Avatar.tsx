import { UserCircle2 } from "lucide-react";

export function Avatar({ src, name, size = 26 }: { src?: string; name?: string; size?: number }) {
  if (src) return <img src={src} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />;
  if (name) return (
    <span style={{ width: size, height: size, fontSize: size * 0.42 }}
      className="grid place-items-center rounded-full bg-gradient-to-br from-[#3fe0ff] via-[#4a7dff] to-[#a45aff] font-ui font-bold text-white">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
  return <UserCircle2 size={size} className="text-subtle" />;
}
