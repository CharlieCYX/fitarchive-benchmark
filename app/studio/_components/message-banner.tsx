/**
 * Server-action feedback banner: reads ?notice= / ?error= set by actions
 * that redirect back after a mutation.
 */
export function MessageBanner({
  searchParams,
}: {
  searchParams: { notice?: string; error?: string };
}) {
  const { notice, error } = searchParams;
  if (!notice && !error) return null;
  return (
    <div
      role="status"
      className={`mb-6 rounded-md border px-4 py-3 text-sm ${
        error
          ? "border-danger/30 bg-danger/5 text-danger"
          : "border-success/30 bg-success/5 text-success"
      }`}
    >
      {error ?? notice}
    </div>
  );
}
