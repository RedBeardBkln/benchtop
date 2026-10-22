// Shown to team members whose ingredient-library access is view only. Edits are refused by the
// server; this explains why before they try.
export function LibraryViewOnlyNotice() {
  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      You have view-only access to the ingredient library and suppliers. Ask an account admin if you need to make changes.
    </div>
  )
}
