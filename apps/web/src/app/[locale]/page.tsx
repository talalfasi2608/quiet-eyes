import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

export default function Home() {
  const t = useTranslations();
  return (
    <>
      <Topbar />
      <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          {t("common.appName")}
        </h1>
        <p className="max-w-xl text-lg text-gray-400">{t("landing.hero")}</p>
        <p className="max-w-lg text-sm text-gray-500">{t("landing.sub")}</p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-gray-950 hover:bg-gray-200"
          >
            {t("common.getStarted")}
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-700 px-6 py-2.5 text-sm font-semibold hover:bg-gray-800"
          >
            {t("common.login")}
          </Link>
        </div>
      </main>
    </>
  );
}
