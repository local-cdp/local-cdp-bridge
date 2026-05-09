# Maintenance Rules

## Boundary

`local-cdp-bridge` is generic browser-control infrastructure.

It may only expose reusable browser primitives, such as:

- open or focus pages
- wait for selectors or text
- click selectors or visible text
- click matching items inside selector collections
- fill editable fields
- upload local file paths
- press keys, scroll, and take screenshots
- handle generic authorization, permissions, paths, and security policy

It must not contain product, website, or workflow-specific automation logic.

## Correct Pattern

If a workflow needs automation, compose it outside this project using bridge primitives:

```ts
[
  click(".some-entry"),
  clickSelectorText(".some-list-item", itemName),
]
```

If an existing primitive is not enough, add a reusable primitive here. Do not add a workflow-specific function.

