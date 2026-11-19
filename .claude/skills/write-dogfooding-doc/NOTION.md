# Publishing to Notion

Notion tools are reached through the portal: `mcp__native__portal_codemode_execute` with `codemode.notion_notion_*` calls.

## 1. Read the template

```
async () => (await codemode.notion_notion_fetch({ id: "<template URL>" })).text
```

Use its body as the starting point for the doc:

- Replace every _[italic placeholder]_ with real content.
- Add or remove persona sections and checklist items to match the approved plan.
- Delete a section whose placeholder says to delete it when it does not apply, such as App Coverage.
- Keep the headings, `---` dividers, callouts, `<b>Objective</b>` sub-bullets and the closing "What's useful" callout.
- Replace the final feedback database placeholder with the database tag from step 4.

## 2. Create the doc page

Every run creates a new page titled `Dogfooding: <feature>`. It is a row in the **Plumber dogfooding docs** database on the [Dogfooding](https://app.notion.com/p/opengov/Dogfooding-41c77dbba788805dbc94da20dd14e910) page. The database's title property is `Name`.

```
async () => codemode.notion_notion_create_pages({
  parent: { data_source_id: "1dbbd5cd-28b2-40e0-bb1f-b320af55e714" },
  pages: [{ properties: { Name: "Dogfooding: <feature>" } }],
})
```

Use another parent only when the user names one. If the database is gone, fetch the Dogfooding page to find its replacement.

Keep the returned page id.

## 3. Create the feedback database

Create it under the new page:

```
async () => codemode.notion_notion_create_database({
  parent: { page_id: "<new page id>" },
  title: "<Feature> feedback",
  schema: `CREATE TABLE ("Title" TITLE, "Type" SELECT('Bug':red, 'Feedback / Question':blue, 'Suggestion':green), "Persona" SELECT(<one option per persona>), "Details" RICH_TEXT, "Reporter" PEOPLE, "Triage status" SELECT('New':yellow, 'Triaging':orange, 'Actioned':green, 'Won''t fix':gray), "Submitted" CREATED_TIME)`,
})
```

Keep the returned database URL.

## 4. Write the page body

Write the body to a local file, without the title. End it with the database tag:

```md
<database url="<database URL>" inline="true" icon="💬">
<Feature> feedback
</database>
```

IMPORTANT: the portal sandbox cannot read local files, and a long body pasted into code is error-prone. Pass it through `mcp__custom-tools__codemode`, which can read the file:

```
const body = await tools.read({ path: "/tmp/<doc>.md", limit: 2000 })
const code = `async () => codemode.notion_notion_update_page({ page_id: "<new page id>", command: "replace_content", new_str: ${JSON.stringify(body)} })`
return JSON.stringify(await tools.mcp__native__portal_codemode_execute({ code }))
```

`replace_content` keeps the database because the body includes its tag.

Use Markdown pipe tables, `- [ ]` checkboxes and `<callout icon="..." color="red_bg">` blocks. Read `notion://docs/enhanced-markdown-spec` with `notion_notion_fetch` for any other syntax.

## 5. Verify

Fetch the page again. Check that:

- The content ends with the `<database>` tag.
- Tables render as rows.
- No `more lines in file` text leaked in from the read tool.
- No `[` placeholder text from the template remains.
