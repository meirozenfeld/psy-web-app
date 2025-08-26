// Home page: reads welcomeName from Outlet context and shows a simple getting-started screen
import { useOutletContext } from "react-router-dom";

type LayoutCtx = { welcomeName: string };

export default function Home() {
    const { welcomeName } = useOutletContext<LayoutCtx>();

    return (
        <>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Welcome{welcomeName ? ` ${welcomeName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
                Select a section from the sidebar to get started.
            </p>

            {/* Initial placeholder content: quick tips and upcoming work */}
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white/70 p-5">
                    <h3 className="font-medium">Quick tips</h3>
                    <ul className="mt-2 list-disc list-inside text-sm text-slate-600">
                        <li>Use the sidebar to navigate between areas.</li>
                        <li>Only Log out is implemented for now.</li>
                    </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white/70 p-5">
                    <h3 className="font-medium">Next up</h3>
                    <p className="mt-2 text-sm text-slate-600">
                        We’ll wire up each section to real pages and data.
                    </p>
                </div>
            </div>

            {/* Mobile-only notice: sidebar is hidden on small screens */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-sky-50 p-4 text-sm text-sky-800 md:hidden">
                On mobile, the sidebar is hidden — open this page on a wider screen to see it.
            </div>
        </>
    );
}
