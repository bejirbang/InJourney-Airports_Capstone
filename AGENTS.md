<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep this delivery a client-side interactive prototype with session-only sample data; do not add real authentication or persistence without an explicit request.
- Place shared role and mock workflow state in a provider around the root Outlet so navigation preserves prototype actions.
- Use one shared workspace with leaf routes for distinct sections; keep each leaf's page-specific metadata in its route definition.
- Centralize prototype PRD permission and workflow predicates in a browser-safe rules module and test them independently.
