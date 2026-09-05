# Stamp Triage Hub

Build the Phase 1 scaffold for a stamp collection triage tool. Single user, no authentication.

DATABASE

Create these Supabase tables with RLS enabled and a permissive policy on each allowing all operations (select, insert, update, delete) for the anon role.

Table containers:

- id uuid primary key default gen_random_uuid()

- label text unique not null (format C01, C02, ...)

- type text not null check (type in ('album','box','loose_sheet','review_book'))

- description text

- created_at timestamptz default now()

Table pages:

- id uuid primary key default gen_random_uuid()

- container_id uuid not null references containers(id)

- label text unique not null (format C01-P03)

- photo_path text

- capture_type text check (capture_type in ('album_page','loose_grid'))

- captured_at timestamptz

- identify_status text not null default 'pending' check (identify_status in ('pending','running','done','failed'))

- raw_model_output jsonb

- page_notes text

- created_at timestamptz default now()

Table stamps:

- id uuid primary key default gen_random_uuid()

- page_id uuid not null references pages(id)

- position_index integer

- crop_path text

- bbox jsonb

- country text

- country_inscription text

- year_estimate integer

- year_confidence numeric

- denomination text

- currency text

- issue_name text

- catalogue_system text

- catalogue_number text

- catalogue_confidence numeric

- item_type text not null default 'unknown' check (item_type in ('postage','revenue','cinderella','label','unknown'))

- mint_or_used text

- hinged_guess text

- gum_state text not null default 'unknown' check (gum_state in ('never_hinged','hinged','no_gum','regummed','unknown'))

- format text not null default 'single' check (format in ('single','block','sheet','on_cover','se_tenant'))

- faults text[]

- perforation text

- watermark text

- condition_notes text

- set_name text

- set_position text

- quantity integer not null default 1

- value_low numeric

- value_high numeric

- value_source text

- value_confidence numeric

- confidence numeric

- review_status text not null default 'pending' check (review_status in ('pending','auto_accepted','confirmed','flagged_expert','rejected'))

- notes text

- tags text[]

- created_at timestamptz default now()

- updated_at timestamptz default now()

Create two public Supabase Storage buckets: "captures" and "crops".

APP

React with TypeScript, Tailwind, shadcn. A persistent left sidebar with links: Dashboard, Capture, Review, Containers, Stamps.

Route / (Dashboard): three summary cards showing total stamp count, count of stamps by review_status, and count of containers. A simple table of counts of stamps grouped by country. All live from Supabase.

Route /containers: table of containers with label, type, description, page count. A "New container" button opening a dialog: select type, optional description. On save, auto-generate the next label in sequence (C01, C02, ...) by querying the highest existing label. Clicking a container shows its pages (label, capture_type, identify_status, captured_at) and a "New page" button that auto-generates the next page label for that container (C01-P01, C01-P02, ...).

Route /capture: form with (1) a container select, (2) a page select filtered to that container, plus an inline "new page" option that creates the page with the next auto-generated label, (3) capture type radio: album_page or loose_grid, (4) an image file input. On submit: upload the image to the captures bucket under {page_label}/{timestamp}.jpg, set the page's photo_path, capture_type and captured_at. Show a success state with the uploaded image preview. Include a disabled "Identify stamps" button with a "coming soon" tooltip. Do not build any identification logic.

Route /review: table of stamps where review_status is 'pending' or 'flagged_expert', columns: crop thumbnail placeholder, country, denomination, confidence, review_status. Empty state text "No stamps to review yet". No edit form yet.

Route /stamps: table of all stamps with columns country, denomination, year_estimate, item_type, review_status, quantity, and a text search over country and issue_name. Empty state supported.

Keep the UI minimal and functional. No sample data, no seed rows, no auth screens.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/44403e6b-8a61-4940-8319-38a89e92ed0f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
