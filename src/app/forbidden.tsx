import Link from "next/link";
export default function Forbidden() {
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-3xl">Access denied</h1><p className="my-4">Your account does not have permission to open this workspace. Contact the owner if you need access.</p><Link href="/" className="font-semibold text-orange-800 underline">Back to dashboard</Link></main>;
}
