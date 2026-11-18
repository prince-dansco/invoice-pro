import { Brand } from "./brand";
import { NavLinks } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-sidebar px-3 py-4 md:flex">
      <div className="px-3">
        <Brand />
      </div>
      <nav aria-label="Main">
        <NavLinks />
      </nav>
    </aside>
  );
}
