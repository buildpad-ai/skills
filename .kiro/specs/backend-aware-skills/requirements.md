# Requirements Document

> **This is the skills repository's part of a change that spans six repositories.** The Platform's
> part is `buildpad-platform`, `.kiro/specs/engine-backed-project-provisioning/requirements.md`.
> Its register asks this repository for two things, PP-38 and PP-39. Its Decision Q, settled on 15
> October 2026 for its option (g), says how one set of skills serves two kinds of project: each
> backend's passages are marked in place in this repository, the Platform removes the other
> backend's when it assembles a kit, and a run-time gate stays in the skills for an install by the
> command-line tool. This document is what PP-38 and PP-39 are, written as requirements this
> repository can build and check by itself. Identifiers of the form `PP-n`, and Decisions lettered
> A to Z, AA and AB, are the Platform document's; Decisions numbered 1 to 13 are the infrastructure
> document's (`xrad-cloudformation`, `.kiro/specs/engine-project-data-service/requirements.md`);
> decisions of this document are written `SD-n`. All are cited here unchanged.
>
> **Decisions settled 15 October 2026.** The Platform settled its Decisions H, I, K, M, N, P and Q
> and question 1 of its Decision J, and this document was amended to follow the five that bear on
> it (see [Decisions settled 15 October 2026](#decisions-settled-15-october-2026)). It now stands
> at 7 requirements and 60 criteria: 4 were added, each at the end of its requirement, and 6 were
> reworded in place; none was withdrawn and none renumbered. SD-1 and SD-2 stayed open after it,
> and no decision of this document was raised.
>
> **Second batch, 15 October 2026.** Later the same day every decision still open in the three
> documents was settled, this document's SD-1 and SD-2 among them, the maintainer answering "agree"
> to a table of recommendations, and this document was amended to follow the ones that bear on it
> (see [Second batch, 15 October 2026](#second-batch-15-october-2026)). It now stands at 7
> requirements and 68 criteria: 8 were added, each at the end of its requirement, 1 was reworded in
> place, and 2, written for choices the maintainer declined, were withdrawn under their numbers;
> none was renumbered. No decision of this document is open, and none was raised. The maintainer
> approved these requirements on 15 October 2026 (the approval note in `spec.json`).
>
> **Skill-map corrections, 16 October 2026.** The maintainer was asked to approve two corrections
> to the Skill_Map that the design found, and answered "approve both skill-map corrections":
> `worker-messaging` moves from unchanged to "both paths, chosen by backend", and `grant-module-access`
> and `references` move from "reworded to be true for both" to "both paths, chosen by backend" (see
> [Skill-map corrections, 16 October 2026](#skill-map-corrections-16-october-2026)). The same
> section records, as an alignment that Requirement 4 criterion 7 already requires, that the two
> microfrontend Skills are not yet available on an Engine_Project while Decision Y's PP-35 is unmet.
> No criterion was added, reworded, withdrawn or renumbered: the document still stands at 7
> requirements and 68 criteria, 66 of them live. The approval stands.

## Introduction

Every skill in this repository was written for one kind of Buildpad project: a per-project
self-hosted Supabase for sign-in, tables, SQL functions, row-level security and migrations, with
the DaaS application in front of it serving a Directus-style `/api`. The skills tell an agent to
call the Supabase client for tables and remote procedures, to hold a service-role key, to write
and push Supabase migrations, to treat the DaaS address as the address of a Next.js application,
and to run stored code against `services.supabase`.

The Platform is introducing a second kind of project, an **Engine_Project**, whose backend is the
Go Engine and which has no Supabase at all. A generated application there keeps the Supabase
client library for sign-in only; everything else the skills teach about Supabase has no
counterpart. Both kinds of project will exist side by side for a long time, and the same skills
reach both: the Platform vendors a copy into every starter kit, and a developer installs or
replaces them in any project, of either kind, with `npx skills add buildpad-ai/skills`.

Who has the problem: a developer on an Engine_Project, whose agent will be told to do things that
cannot work there and will write code that fails at its first request; a developer on an existing
Supabase project, whose guidance must not change under them; and the maintainers of this
repository, who have no way today to say which revision of the skills a project holds.

What changes: each skill whose steps differ by backend establishes which kind of project it is in
before it directs anything that differs; on an Engine_Project it directs only what the Engine
serves, and says plainly what is not available; on a Supabase project it directs what it directs
today. The repository gains named revisions and a check of its own, because one of the two
channels by which skills reach a project does not pass through the Platform.

### What this document cannot settle

**How** a skill serves both kinds of project was the Platform's Decision Q. It was settled on 15
October 2026 for its option (g): every Backend_Passage is marked in place in this repository; the
Platform removes the other backend's marked passages mechanically when it assembles a Kit, in every
IDE layout and in a worker's Kit; and the procedure by which a Skill establishes the backend
(Requirement 1) stays in the Skills for a Raw_Install, which delivers both passages. Requirements
1, 2, 5 and 7, which waited on that decision, now follow it, and Requirement 7 criterion 1 can be
built. Removing passages from a Kit is the Platform's work and out of scope here (the Platform's
Requirement 7 criteria 19 to 21). What this document still cannot settle by itself: the syntax of
the markers and the name and form of the Backend_Signal, which Decision Q left to design and which
this repository and the Platform's design fix together. No decision listed under
[Decisions](#decisions) is open.

### Verification caveat

Every fact here was **read, not observed**. On 13 October 2026 two readers classified each of the
64 folders of this repository (62 skills, the agent personas and the shared references): the
first read every file of every skill and named an Engine counterpart for each assumption; the
second re-opened the Engine's routes and documents for every counterpart the first claimed, and
searched each folder again for what the first missed. The second reader corrected 92 claims of an
Engine counterpart and added 212 assumptions. The revisions read were this repository's working
tree on branch `docs/ide-neutral-instruction-paths` at `ad57772`, which is not the default
branch; `buildpad-daas-go` `main` at `d893e3cd`; `buildpad-daas` `feat/go-backend-switch` at
`a13d499b`; `buildpad-platform` `main` at `6c2417d`; and `buildpad-ui` as checked out. No agent
was run against any skill, so nothing here says an agent obeys a condition written into a skill.
The skill map at the end of this document is those readers' result and is re-read against the
default branch before the design of any skill begins.

On 15 October 2026, to record the Platform's Decision AB, the names of this repository's folders
were listed once more, at the same revision, `ad57772`, on the same branch; no file was read. By
that listing, this repository holds specification-settings templates in the `settings-templates`
folders of three Skills, `buildpad-spec-init`, `buildpad-steering` and `buildpad-steering-custom`.
That the templates a Kit carries are byte-identical to content of this repository is the Platform's
finding (its Decision AB).

## Glossary

- **Skill**: a top-level folder of this repository that holds a `SKILL.md`, with its `references`
  and `assets`.
- **Entry_File**: a Skill's `SKILL.md`.
- **Shared_Guidance**: the two top-level folders that are not Skills and that starter kits also
  carry: the agent personas in `agents` and the checklists in `references`.
- **Engine**: `buildpad-daas-go`, the Directus-compatible data API of an Engine_Project.
- **Studio**: the administration interface in front of the Engine. It is not the API.
- **Supabase_Project** / **Engine_Project**: a project whose backend is the self-hosted Supabase
  with the DaaS application / the Engine.
- **Engine_URL**: the one public address of an Engine_Project's data API. Both
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_BUILDPAD_DAAS_URL` name it there.
- **Project_Tenant**: the one tenant of an Engine_Project's Engine. A project is one tenant;
  scopes are the levels below it.
- **Tenant_Variable**: the environment variable under which an application is given the
  Project_Tenant's identifier. Its name is fixed by the Platform's design.
- **Service_Token**: the Platform's static token that the Engine accepts on its MCP endpoint as the
  project's administrator; a Kit's MCP configuration carries it. Under the Platform's Decision H
  the Engine refuses it on the data API.
- **Worker_Token**: the static token of a separate, narrower account that the Platform gives a
  worker as `DAAS_TOKEN`, and that the Engine accepts on its data API (the Platform's Decision H,
  settled 15 October 2026; PP-30).
- **Backend_Signal**: what an agent reads in a project to learn which kind of project it is in. The
  Platform writes it into every Kit it assembles, in a file version control keeps (the Platform's
  Requirement 7 criterion 22); its name and form are left to design (the Platform's Decision Q,
  settled 15 October 2026).
- **Backend_Passage**: a part of a Skill's text or files that is true for one kind of project only,
  marked in place in this repository with the kind it applies to. The Platform removes the other
  kind's when it assembles a Kit; a Raw_Install carries both (the Platform's Decision Q, settled 15
  October 2026). The syntax of the markers is left to design.
- **Kit**: a starter kit the Platform assembles for a project, holding a vendored copy of the
  Skills and the Shared_Guidance.
- **Raw_Install**: the Skills as the skills command-line tool writes them into a project, straight
  from this repository, with nothing assembled or removed.
- **Invalid_Instruction**: an instruction of one of the kinds the Platform's Requirement 7
  criterion 4 lists as invalid for an Engine_Project, restated in Requirement 3 criteria 1 and 2
  below.
- **Specification_Templates**: the specification-settings templates that this repository holds in the
  `settings-templates` folders of `buildpad-spec-init`, `buildpad-steering` and
  `buildpad-steering-custom`, and that a Kit carries. This repository owns them (the Platform's
  Decision AB, settled 15 October 2026).
- **Recorded_Answer**: a developer's answer to which kind a project is, which a Skill records where
  the procedure of Requirement 1 criterion 1 finds it (SD-1).
- **Skill_Map**: the table at the end of this document: each folder, how far it depends on a
  per-project Supabase, and the treatment the two readers proposed.
- **Baseline_Revision**: the last revision of the default branch before any change made for this
  feature.
- **Repository_Check**: an automated check that runs in this repository on every change proposed
  to the default branch.

## Decisions

Settled decisions are recorded so that nothing is chosen silently. Open decisions state their
tradeoff and carry no default. On 15 October 2026 the maintainer settled SD-1 and SD-2, answering
"agree" to a recommendation for each; no decision of this document is open.

**Decisions this document inherits from the documents that own them.** Settled on 15 October 2026:
the Platform's Decision Q (option (g): Backend_Passages marked in place here and removed by the
Platform when it assembles a Kit, with the gate kept for a Raw_Install) governs the form of
Requirements 1, 2, 5 and 7; its Decision H (option (b): the Engine accepts a static token on its
data API, and a worker is given the Worker_Token of a separate, narrower account and never the
Service_Token) governs what the worker and automation Skills say about a token; its Decision M
(option (b): the Engine answers no credentialed cross-origin request, and the consumer SDK is to
send none) governs what the Skills say about the consumer SDK's browser calls; its Decision N
(option (a): the Platform chooses the Project_Tenant's identifier when it accepts the create
request) fixes who chooses that identifier; and its Decision P (option (a): the scheduler runs) lets
the scheduled-job Skills state that a job fires. Settled later the same day: its Decision O (option
(a): a Generated_App's password sign-in names the Project_Tenant, and the Engine refuses an account
with no role there) governs what a Skill says about such a user (Requirement 3 criteria 16 and 17);
its Decision Y (option (a): the Engine makes the renewal of one session by several holders safe)
lets the microfrontend Skills hand one session to several holders once PP-35 is met; its Decision AA
(option (a) of question 1 and option (b) of question 2: the Worker_Account may create, read, update
and delete the items of every collection a member creates and nothing else, and the worker starter's
MCP configuration carries the Worker_Token) settles what a worker Skill may promise (Requirement 5
criterion 9); its Decision AB (option (b): the references and the Specification_Templates a Kit
carries are this repository's, synced and stripped by the Platform as the Skills are) brings them
into this document's scope (Requirement 5 criterion 10, Requirement 7 criterion 9); and the
infrastructure's Decision 13 (option (c): constants of its template) settles how the name of the
Tenant_Variable reaches the infrastructure, the name itself being still the Platform's design's to
fix. None is open.

**SD-1 — what a Skill does when it cannot tell which kind of project it is in. SETTLED 15 October
2026.** Three states: a Skill follows the Engine path only on a positive Engine signal, the Supabase
path only on positive evidence of a Supabase_Project, and otherwise asks the developer once and
records the answer where the next run finds it. The recommendation was put to the maintainer as
"Three states; ask once and record", and the maintainer answered "agree".

Found before the choice: A Kit-made Engine_Project can lack every signal: the environment file and
the MCP configuration are ignored by version control, so a teammate's fresh clone and an agent in a
pipeline have neither. Found 15 October 2026: the Platform's Decision Q, settled for option (g), has
the Platform write the Backend_Signal into every Kit in a file version control keeps (the Platform's
Requirement 7 criterion 22), so a fresh clone of a project whose Kit was assembled after that change
holds the signal. The question stood for a project whose Kit is older, and for a Raw_Install into a
repository that never received a Kit.

What follows: Requirement 1 criterion 5 holds without condition, and criterion 4, written for the
declined choice, is withdrawn; criteria 10 and 11 make each path need positive evidence or a
Recorded_Answer, and criterion 12 records the answer in a file version control keeps. What counts as
positive evidence of a Supabase_Project, and the name and form of the Recorded_Answer, are left to
design. The cost stands: one question in every old project that has neither signal, and a committed
place to record the answer.

- Declined: an absent Backend_Signal means a Supabase_Project, which would have left every existing
  project exactly as it is with no question asked, and given an Engine_Project Supabase guidance,
  silently, whenever its signal was missing.

**SD-2 — whether a release is checked by running an agent. SETTLED 15 October 2026.** The first
choice: a release for this feature is checked by reading and by the Repository_Check alone, which is
what the repository does today. The recommendation was put to the maintainer as "No; reading plus
the repository check", and the maintainer answered "agree".

Found before the choice: Nothing in this repository runs an agent against a Skill, and whether an
agent follows a condition written into a Skill was not determined.

What follows: Requirement 7 criterion 6, owed only under trial runs, is withdrawn. No criterion is
added: the Repository_Check already runs on every change proposed to the default branch (glossary),
and checking by reading needs none. The cost stands: the check proves nothing about an agent's
behaviour, and the verification caveat's statement that nothing here says an agent obeys a condition
written into a Skill still holds.

- Declined: a set of trial runs, in which an agent is given a project of each kind and each
  backend-dependent Skill and what it does is compared with what the Skill directs, which would have
  needed a harness, a project of each kind to run against, and time on every release.

## Boundary Context

- **In scope**: the text and files of every Skill and of the Shared_Guidance, the references and the
  Specification_Templates a Kit carries among them, which this repository owns (the Platform's
  Decision AB); how a Skill establishes the backend, asking the developer once and recording the
  answer when it cannot tell (SD-1), and what it does on each; what a Skill says where the Engine has no
  counterpart; named revisions of this repository and what its README tells a developer to run;
  the Repository_Check.
- **Out of scope**:
  - Guidance the Platform authors itself: the always-loaded instruction file, the Kit's README,
    the project templates, and the generated environment file and MCP configuration. They state
    Supabase as the stack today and are the Platform's work under its Requirement 7.
  - The Platform's sync script and its assembly of a Kit, including copying the references and the
    Specification_Templates into a Kit and removing Backend_Passages from them as from the Skills,
    which Decisions Q and AB give the Platform to do (the Platform's Requirement 7 criteria 19 to
    21, 27 and 28).
  - The files the consumer command-line tool generates from its own templates (PP-36), and the
    consumer SDK (PP-21).
  - Writing the Backend_Signal into a project.
  - The Engine and the Studio.
  - `buildpad-copilot`, an older copy of these skills, and the engineering skills of the same
    names that other repositories keep for their own code.
  - Moving a Supabase_Project to the Engine.
  - Running an agent against a Skill to check a release (SD-2).
- **Adjacent expectations**: this repository relies on the Platform's design, together with this
  repository, to fix the syntax of the markers and the name and form of the Backend_Signal, which
  Decision Q left to design; on the Platform to copy the references and the Specification_Templates into a Kit and to remove the
  other kind's Backend_Passages from them and from the Skills when it assembles a Kit, to write the Backend_Signal into every Kit, and to vendor a named revision; on the Engine for the routes, runtime and MCP tools a Skill names;
  and on `buildpad-ui` for an SDK and templates that work on an Engine_Project. Where one of those
  is not yet true it is listed under [Dependencies](#dependencies). This repository does not
  decide what kind a project is.

## Requirements

### Requirement 1: A Skill establishes the backend before it directs anything that differs

**Objective:** As a developer, I want a skill to find out what kind of project it is in, so that
my agent is never given steps for the other kind.

#### Acceptance Criteria

1. The Skills shall name one Backend_Signal and one procedure for reading it, worded the same in
   every Skill that uses it. (Follows Decision Q, settled 15 October 2026.)
2. When a Skill holds a Backend_Passage, the Skill shall direct its reader to establish the
   backend before the reader reaches the first Backend_Passage, in the Entry_File and in every
   reference or asset file that holds one.
3. When a file of one Skill is reached by a link from another Skill, the file shall direct its
   reader to establish the backend before its first Backend_Passage, without relying on the
   reader having opened either Entry_File.
4. Withdrawn 15 October 2026: SD-1 chose three states.
5. When the Backend_Signal neither says Engine_Project nor shows a Supabase_Project, and no
   Recorded_Answer is found, the Skill shall direct its reader to ask the developer which kind the
   project is, once, and to record the answer where the procedure of criterion 1 finds it. (Follows
   SD-1, settled 15 October 2026.)
6. When a Skill is installed with no other Skill present, the Skill shall hold or reach
   everything its reader needs to establish the backend.
7. The procedure of criterion 1 shall place no key, password or token in the reader's context.
8. When the backend is established as an Engine_Project, the Skill shall direct its reader to no
   passage marked for a Supabase_Project, and when it is established as a Supabase_Project, to
   no passage marked for an Engine_Project.
9. The Skills shall mark every Backend_Passage in place, in the file that holds it, with markers
   that name the kind of project it applies to and that let the passage be removed without removing
   anything else. (Follows Decision Q, settled 15 October 2026.)
10. The Skill shall direct its reader to follow the Engine_Project passages only when the
    Backend_Signal says Engine_Project or the Recorded_Answer does. (Follows SD-1, settled 15
    October 2026.)
11. The Skill shall direct its reader to follow the Supabase_Project passages only on positive
    evidence of a Supabase_Project, of a kind the design names, or on the Recorded_Answer. (Follows
    SD-1, settled 15 October 2026.)
12. The Skills shall direct that the Recorded_Answer be written to a file that version control
    keeps. (Follows SD-1, settled 15 October 2026.)

### Requirement 2: A Supabase project's guidance still directs what it directed

**Objective:** As a developer on an existing project, I want the skills to keep telling my agent
what they tell it today, so that this feature changes nothing for me.

#### Acceptance Criteria

1. When the backend is established as a Supabase_Project, each Skill shall direct its reader to
   the same actions, files, commands and calls as that Skill does at the Baseline_Revision.
2. The Skills shall leave the Skills that the Skill_Map lists as unchanged identical to the
   Baseline_Revision, file for file.
3. When every Engine_Project passage is removed from a Skill, as the Platform does when it
   assembles a Kit for a Supabase_Project, the text that remains shall be complete: no step, link
   or code sample of the Supabase_Project path shall be missing or left dangling. (Follows Decision
   Q, settled 15 October 2026.)
4. If a change for this feature would make a Skill direct a Supabase_Project's reader
   differently from the Baseline_Revision, then the change shall be named in the release notes of
   the revision that carries it, with the reason.
5. The frontmatter name of every Skill shall be the one it has at the Baseline_Revision.

### Requirement 3: What a Skill directs on an Engine_Project

**Objective:** As a developer on an Engine_Project, I want every skill to direct only what the
Engine serves, so that what my agent builds works at its first request.

#### Acceptance Criteria

1. When the backend is established as an Engine_Project, no Skill and no Shared_Guidance file
   shall direct its reader to: call a Supabase remote procedure or a Supabase table endpoint; use
   a service-role key or the Supabase administration API for accounts; change a password, exchange
   a code or verify a one-time code through the Supabase client; use the Supabase service in
   stored automation code; write a database policy, write SQL against Supabase's own schemas, or
   write or push a Supabase migration; set Supabase storage or bucket options; call the data API
   with a cookie session; set cross-origin options through the data service's MCP tools; call a
   data-service MCP tool the Engine does not serve; or read a Supabase address or key from the
   Platform's MCP tool, or stop because one is absent.
2. When the backend is established as an Engine_Project, no Skill shall direct its reader to call
   the data API with the Service_Token. (Follows Decision H, settled 15 October 2026.)
3. When the backend is established as an Engine_Project, each Skill that names the data service's
   address shall name the Engine_URL for every data call, and shall direct no call to the Studio.
4. When the backend is established as an Engine_Project, each Skill that sets a project's
   environment shall set both address variables to the Engine_URL, shall give the anon-key
   variable the fixed value the Kit supplies, shall set the Tenant_Variable, and shall name no
   service-role key.
5. When the backend is established as an Engine_Project, each Skill that describes sign-in shall
   state that password sign-in, session refresh, reading the signed-in user and sign-out are
   available through the Supabase client, and that sign-out ends the user's sessions on every
   device.
6. When the backend is established as an Engine_Project, each Skill that creates a collection, a
   field, a relation, a role, a policy or a permission shall do so through the data service's API
   or its MCP tools, and shall describe access in terms of roles, policies and permissions.
7. When the backend is established as an Engine_Project, each Skill that creates a user, in an
   application or in a test, shall do so as an administrator through the Engine's user API or the
   Studio's Users module.
8. When the backend is established as an Engine_Project, each Skill that directs a request made
   without a session shall direct that the request names the Project_Tenant with the
   Tenant_Variable's value.
9. When the backend is established as an Engine_Project, the Skills that teach scopes shall treat
   the project as one tenant, shall begin every hierarchy below the Project_Tenant, and shall not
   direct the creation of a scope type or a scope item that has no parent.
10. When the backend is established as an Engine_Project, each Skill that teaches stored
    automation code shall teach only what the Engine's runtime provides, and shall name, for each
    interface it teaches on a Supabase_Project that the Engine's runtime refuses or lacks, that it
    is unavailable and what replaces it where something does.
11. When the backend is established as an Engine_Project, each Skill that stores or serves a file
    shall use the Engine's file routes.
12. When the backend is established as an Engine_Project, the Skills that write tests shall build
    their fixtures, their sign-in and their environment from what criteria 4, 5 and 7 allow, and
    shall name no Supabase secret for a pipeline.
13. The Shared_Guidance shall state each check that names row-level security, a service-role key
    or a Supabase setting as a check for a Supabase_Project, and shall state the check that
    stands in its place for an Engine_Project where there is one.
14. When the backend is established as an Engine_Project and the Dependencies list the Engine's
    scheduler as available, the Skills that define a scheduled job shall state that the job fires
    at its scheduled time. (Follows Decision P, settled 15 October 2026.)
15. When every Supabase_Project passage is removed from a Skill, as the Platform does when it
    assembles a Kit for an Engine_Project, the text that remains shall be complete: no step, link
    or code sample of the Engine_Project path shall be missing or left dangling. (Follows Decision
    Q, settled 15 October 2026.)
16. When the backend is established as an Engine_Project, each Skill that describes sign-in shall
    state that an account holding no role in the Project_Tenant is refused at sign-in. (Follows
    Decision O, settled 15 October 2026.)
17. When the backend is established as an Engine_Project, each Skill that creates a user shall give
    that user a role in the Project_Tenant. (Follows Decision O, settled 15 October 2026.)

### Requirement 4: What a Skill says where the Engine has no counterpart

**Objective:** As a developer on an Engine_Project, I want a skill to tell me plainly when what I
asked for does not exist there, so that my agent does not improvise something that cannot work.

#### Acceptance Criteria

1. When the backend is established as an Engine_Project, the Skill that adds external OAuth
   sign-in shall state that it is unavailable on an Engine_Project and shall direct its reader to
   write no file.
2. When the backend is established as an Engine_Project, no Skill shall direct its reader to the
   Platform's password-less handoff as a way for an application to sign a user in.
3. When the backend is established as an Engine_Project, the Skill that writes database
   migrations shall state that an Engine_Project has none, shall direct its reader to write no
   file, and shall name the Skills that change structure and access there.
4. When a request for a table, a column or a schema change reaches the migration Skill on an
   Engine_Project, the Skill shall direct its reader as criterion 3 says before any other step.
5. When the backend is established as an Engine_Project, each Skill that describes sign-in shall
   name as unavailable: sign-up; OAuth sign-in; magic link and one-time code; password recovery;
   changing a password, an email or a profile through the Supabase client; code exchange; and
   the administration API.
6. When the backend is established as an Engine_Project, each Skill that describes multi-factor
   sign-in shall state that enrolment, challenge and verification are not served through the
   Supabase client and shall name the Engine's own routes for them.
7. While something a Skill's Engine_Project path needs is listed under Dependencies as unmet or
   undecided, the Skill shall state that the capability is not yet available on an
   Engine_Project and shall give no steps for it.
8. If a Skill's reader on an Engine_Project asks for a capability the Skill states is
   unavailable, then the Skill shall direct its reader to tell the developer so and to stop,
   and shall not direct a substitute.

### Requirement 5: Each folder receives the treatment its dependence calls for

**Objective:** As a maintainer, I want every skill's treatment decided from a reading of that
skill, so that none is changed more than it needs and none is missed.

#### Acceptance Criteria

1. The Skills shall give every folder in the Skill_Map a treatment, and every folder of this
   repository that holds a `SKILL.md`, and both Shared_Guidance folders, shall be in the
   Skill_Map.
2. When a folder's dependence in the Skill_Map is wording only, the Skills shall reword it so
   that each statement is true for both kinds of project, and shall add no Backend_Passage to it.
3. When a Skill's steps for an Engine_Project and a Supabase_Project differ for most of the Skill,
   the Skill shall keep the two as separate file sets, each complete without the other and each
   marked as a Backend_Passage of its kind. (Follows Decision Q, settled 15 October 2026.)
4. The Skill that writes API routes shall, on an Engine_Project, direct that every data route
   forwards the caller's session to the Engine_URL, and shall attach no guidance on Supabase
   tables, remote procedures or a service-role key to an Engine_Project's route files.
5. The Skill that describes the data platform shall state the architecture, the environment, the
   way a request is authenticated, the cross-origin rule and the storage of files as each is on
   the backend that was established, and shall state none of them as true for both where they
   differ.
6. The specification and steering Skills shall hold, in the templates and rules they copy into a
   project, no statement that the project's database, sign-in or migrations are Supabase's.
7. The Skill that teaches a worker to reach the data service shall, on an Engine_Project, name the
   Engine_URL as the address and direct the worker to present its own Worker_Token, read from
   `DAAS_TOKEN`, and never the Service_Token. (Follows Decision H, settled 15 October 2026.)
8. When a Skill is added to this repository after this feature, the Skill shall be given a row
   in the Skill_Map and shall meet Requirements 1 to 4.
9. The Skill that teaches a worker to reach the data service shall, on an Engine_Project, state that
   the worker may create, read, update and delete the items of every collection a member creates,
   and may change no collection, field, relation, role, policy, permission, account or setting.
   (Follows Decision AA, settled 15 October 2026.)
10. The Shared_Guidance shall mark in place, as a Backend_Passage of its kind and with the markers
    of Requirement 1 criterion 9, every passage that holds for one kind of project only. (Follows
    Decision AB, settled 15 October 2026.)

### Requirement 6: A revision of the Skills can be named

**Objective:** As a maintainer, I want every released state of the skills to have a name, so that
a kit can be reproduced and an older set installed again.

#### Acceptance Criteria

1. The repository shall carry a tag on the Baseline_Revision.
2. The repository shall carry a tag on every revision released after the Baseline_Revision, and a
   record of what changed in it.
3. When a developer installs the Skills at a tag, the developer shall receive the Skills as they
   stood at that tag.
4. The README shall state the command that installs the Skills at the Baseline_Revision, for a
   Supabase_Project whose developer does not want the later ones.
5. The README shall state what the check and update commands of the skills command-line tool do
   in a Kit-made project, as they behave there.
6. The README shall state that the Skills serve both kinds of project and how a Skill establishes
   which.
7. The README shall list every Skill with a description that is true for both kinds of project,
   or that names the kind it applies to.

### Requirement 7: The repository checks itself

**Objective:** As a maintainer, I want the repository to refuse a change that breaks these
rules, so that the channel that does not pass through the Platform is still guarded.

#### Acceptance Criteria

1. If a file holds an Invalid_Instruction outside a Backend_Passage marked for a Supabase_Project,
   then the Repository_Check shall fail and shall name the file and the line. (Follows Decision Q,
   settled 15 October 2026.)
2. If a file holds a Backend_Passage and does not direct its reader to establish the backend
   before it, then the Repository_Check shall fail and shall name the file.
3. If a folder that holds a `SKILL.md` has no row in the Skill_Map, or a row names a folder that
   does not exist, then the Repository_Check shall fail and shall name it.
4. If a Skill's or an agent persona's frontmatter lacks a name or a description, then the
   Repository_Check shall fail and shall name the file.
5. If a link from one Skill's file to another Skill's file does not resolve, then the
   Repository_Check shall fail and shall name the link.
6. Withdrawn 15 October 2026: SD-2 chose reading and the Repository_Check alone.
7. The Repository_Check shall pass on the Baseline_Revision for criteria 3, 4 and 5.
8. If the markers of a Backend_Passage do not open and close in pairs, or name a kind other than
   the two, then the Repository_Check shall fail and shall name the file and the line. (Follows
   Decision Q, settled 15 October 2026.)
9. The Repository_Check shall apply criteria 1, 2 and 8 to every file of the Shared_Guidance and to
   every file of the Specification_Templates. (Follows Decision AB, settled 15 October 2026.)

## Dependencies

What this repository needs from elsewhere before a criterion can hold. Statuses are the Platform
and infrastructure documents' as read on 13 October 2026, brought up to date on 15 October 2026 for
the decisions settled that day, in both batches; `SP-n` rows are found here. On 23 October 2026,
at the maintainer's request, row PP-29 was recorded as met and row PP-28 was added, met, from
`buildpad-daas-go` `8966049b` (Engine 0.1.0-dev.7); no criterion changed (design, Engine-fact
corrections, 23 October 2026). On 25 October 2026, at the maintainer's request, row Decision P was
recorded as met; no criterion changed (design, Engine-fact corrections, 25 October 2026).

| ID | Owner | What it is | Needed by | Status when read |
|---|---|---|---|---|
| Decision Q | Platform | How Backend_Passages are marked, what the Backend_Signal is, and whether a Kit may hold a passage for the other backend | 1.1, 1.9, 2.3, 3.15, 5.3, 7.1, 7.8 | Settled 15 October 2026, option (g): marked in place here; the Platform removes the other backend's when it assembles a Kit, so a Kit holds none for the other backend; the gate stays for a Raw_Install. The syntax of the markers and the Backend_Signal's name and form are left to design |
| SP-1 | Platform | The Backend_Signal written into every Kit, including a Kit of agent files only and a worker's Kit, where version control keeps it | 1.1, 1.5, 1.6 | Unmet. Nothing in a project states its backend today; the two files that could are ignored by version control. The Platform's Requirement 7 criterion 22, added 15 October 2026, now requires the Platform to write it |
| SP-2 | Platform | A sync that vendors a named revision of this repository from its default branch and records which | 6.2, 6.3 | Unmet. The sync copies whatever the neighbouring checkout holds and records nothing; on 13 October 2026 that checkout was on a feature branch. The Platform's PP-39 is the other half of this |
| Decision N, infra Decision 13 | Platform, infrastructure | Who chooses the Project_Tenant's identifier, and the name of the Tenant_Variable | 3.4, 3.8 | Decision N settled 15 October 2026, option (a): the Platform chooses the identifier, and a Kit carries it from the Platform's record. Infra Decision 13 settled 15 October 2026, option (c): the name of the Tenant_Variable is a constant of the infrastructure's template, as the Platform's configuration reference states it. The name itself is the Platform's design's and is not yet fixed |
| Decision H | Platform | Whether the Engine's data API accepts a static token, and what a worker presents | 3.2, 5.7 | Settled 15 October 2026, option (b): a worker presents its own Worker_Token, never the Service_Token. Unmet: PP-30, the Engine accepting the Worker_Token on its data API; today every route but the MCP endpoint refuses a static token |
| Decision M, PP-21 | Platform, `buildpad-ui` | Browser calls by the consumer SDK that the Engine accepts | 3.1, 5.5 | Decision M settled 15 October 2026, option (b): the Engine answers no credentialed request, and the SDK is to send none. Unmet: the last clause of PP-21; the SDK sends credentialed requests that a browser refuses against the Engine's answer |
| Decision P | Platform, infrastructure | Whether an Engine_Project runs the Engine's scheduler | 3.10, 3.14, 4.7 | Settled 15 October 2026, option (a): the scheduler runs, so the scheduled-job Skills may state that a job fires (3.14). Met 25 October 2026: every creation path of an Engine_Project runs the Engine's scheduler (`buildpad-daas cron worker`) next to the Engine's server, from the same image (the infrastructure's Requirement 2 criterion 14), and has done so since the first one (16 October 2026); seen running on a live Engine_Project on 25 October 2026. ES-13n is retired and ES-13m stands. Before 25 October 2026: unmet until a creation path runs it; until then Requirement 4 criterion 7 applied |
| PP-29 | Engine | The data-service MCP tools the Skills name: cron, services, extensions, cors-settings, smtp-settings and module access keys | 3.1, 3.6, 4.7 | Met 23 October 2026: the Engine serves all six from 0.1.0-dev.4, to an administrator only. Before 23 October 2026: unmet, the Engine served none of the six |
| PP-28 | Engine | The Engine allowing `X-Tenant-Id` from another origin, so that a browser may name the tenant | 3.8, 3.11 | Added and met 23 October 2026: from 0.1.0-dev.3 the Engine always allows `X-Tenant-Id` cross-origin, from any origin and without credentials |
| PP-36 | `buildpad-ui` | Command-line templates that generate nothing an Engine_Project cannot use | 3.1, 5.4 | Unmet. The tool generates a service-role client and a remote-procedure permission check whatever a Skill says |
| PP-34 | `buildpad-ui` | An SDK and templates that read the Tenant_Variable and name the tenant on a request without a session | 3.8 | Unmet |
| Decision O, PP-37 | Platform, `buildpad-ui` | What happens to a user who holds no role in the Project_Tenant | 3.5, 3.7, 3.16, 3.17 | Settled 15 October 2026, option (a): a Generated_App's password sign-in carries `X-Tenant-Id`, and the Engine refuses an account with no role in the Project_Tenant. Unmet: PP-37 in its first form, owner `buildpad-ui` |
| Decision Y, PP-35 | Platform, Engine | A session that survives being renewed by several holders at once | 3.5 | Settled 15 October 2026, option (a): the Engine answers a refresh token presented again within a short interval after its rotation with the session that rotation produced. Unmet: PP-35 in its first form. It bears on the microfrontend Skills, which hand one session to several holders; until it is met Requirement 4 criterion 7 applies to them |
| Decision AA | Platform | What the Worker_Account's role permits, and which token the worker starter's MCP configuration carries | 5.7, 5.9 | Settled 15 October 2026: question 1 option (a), the Worker_Account may create, read, update and delete the items of every collection a member creates and nothing else; question 2 option (b), the worker starter's MCP configuration carries the Worker_Token, so an agent in a worker repository can do only what that role permits. Unmet until the Engine accepts the Worker_Token on its data API (PP-30) and can express a permission over collections not yet created (PP-16) |
| Decision AB | Platform | Who owns the references and the specification-settings templates a Kit carries | 3.13, 5.10, 7.9 | Settled 15 October 2026, option (b): this repository owns them; the Platform's sync copies them and its assembly strips the other backend's Backend_Passages from them (the Platform's Requirement 7 criteria 27 and 28) |

## Decisions settled 15 October 2026

Written on 15 October 2026. The Platform settled its Decisions H, I, K, M, N, P and Q and question
1 of its Decision J, its maintainer answering "agree with all 8, record them and continue". This
section lists, for each that bears here, every criterion of this document made unconditional,
reworded, withdrawn or added, every dependency row changed, and every decision raised. No agent was
run and no repository was read again. The document stood at 7 requirements and 56 criteria and now
stands at 7 requirements and 60: 4 were added, each at the end of its requirement, and 6 were
reworded in place; none was withdrawn and none renumbered. SD-1 and SD-2 stayed open in that batch, with a dated
fact added to SD-1; no decision of this document was raised.

- **Decision Q, option (g).** No longer resting on it, each stating the chosen form: 1.1, 2.3 (a
  Kit for a Supabase_Project, from which the Platform removes the Engine passages), 5.3 (each file
  set marked as a Backend_Passage) and 7.1. Added: 1.9 (every Backend_Passage marked in place,
  removable without removing anything else), 3.15 (an Engine kit's text complete once the Supabase
  passages are removed) and 7.8 (the Repository_Check refuses unpaired markers). Glossary:
  Backend_Signal and Backend_Passage. Header, the section on what this document cannot settle,
  Boundary Context (out of scope and Adjacent expectations), the inherited decisions, SD-1's dated
  fact, the Skill map's preface. Rows: Decision Q settled; SP-1's status names the Platform's
  criterion that now requires the signal. The removal of passages from a Kit is the Platform's (its
  Requirement 7 criteria 19 to 21) and is out of scope here.
- **Decision H, option (b).** Reworded: 3.2 (no Skill directs the data API to be called with the
  Service_Token; the criterion as first written was to be withdrawn if the Engine came to accept a
  static token, and is instead reworded to the maintainer's choice, never the administrator's
  token) and 5.7 (a worker presents its own Worker_Token from `DAAS_TOKEN`). Glossary:
  Invalid_Instruction now points at criteria 3.1 and 3.2; new entries Service_Token and
  Worker_Token. Row Decision H settled, with PP-30 unmet. Row Decision AA added.
- **Decision M, option (b).** No criterion changed: criterion 3.1 already forbids a call to the
  data API with a cookie session. Row Decision M, PP-21: settled, with the last clause of PP-21
  unmet.
- **Decision N, option (a).** No criterion changed. Row Decision N, infra Decision 13: who chooses
  the identifier is settled; the name of the Tenant_Variable is still not fixed.
- **Decision P, option (a).** Added: 3.14 (the scheduled-job Skills state that a job fires, once
  the Dependencies list the scheduler as available). Row Decision P settled, unmet until a creation
  path runs the scheduler.
- **Decisions I, K and question 1 of J.** Change nothing here.
- **Raised by the Platform, open (both settled in the second batch).** Its Decision AA (the Worker_Account) and Decision AB (who owns
  the references and the specification-settings templates a Kit carries) have rows under
  Dependencies; no criterion rests on either.
- **Still open after the first batch.** SD-1 and SD-2; of the documents this one depends on, the
  Platform's Decisions O, Y, AA and AB, and the infrastructure's Decision 13. All of them were
  settled later the same day, in the second batch below.

### Second batch, 15 October 2026

Written later on 15 October 2026. The maintainer was put a table with a recommendation for every
decision still open in the three documents, SD-1 and SD-2 among them, and answered "agree". This
section lists, for each decision that bears here, every criterion made unconditional, reworded,
withdrawn or added, and every dependency row changed. No agent was run and no file of any repository
was read again; the names of this repository's folders were listed once (the verification caveat).
No criterion was renumbered. The document stood at 7 requirements and 60 criteria and now stands at
7 requirements and 68: 8 criteria were added, each at the end of its requirement; 1 was reworded in
place; and 2 were withdrawn under their numbers, each replaced by the line "Withdrawn 15 October
2026" and the choice its decision made, so that 66 are live. No decision of this document is open
and none was raised.

- **SD-1, three states.** Made unconditional: 1.5 (and asks only when no Recorded_Answer is found).
  Withdrawn: 1.4, written for the declined choice. Added: 1.10 (the Engine path only on an Engine
  signal or a Recorded_Answer), 1.11 (the Supabase path only on positive evidence or a
  Recorded_Answer) and 1.12 (the answer recorded in a file version control keeps). Glossary:
  Recorded_Answer. Left to design: what counts as positive evidence of a Supabase_Project, and the
  name and form of the Recorded_Answer. Boundary Context, In scope.
- **SD-2, reading and the Repository_Check alone.** Withdrawn: 7.6, written for trial runs. No
  criterion added. Boundary Context, Out of scope.
- **The Platform's Decision O, option (a).** Added: 3.16 (sign-in Skills state that an account with
  no role is refused) and 3.17 (user-creating Skills give the user a role). Row Decision O, PP-37:
  settled, owner `buildpad-ui` only.
- **Its Decision Y, option (a).** No criterion. Row Decision Y, PP-35: settled, owner the Engine.
- **Its Decision AA, option (a) of question 1 and option (b) of question 2.** Added: 5.9 (the worker
  Skill states what a worker may and may not do). Row Decision AA settled.
- **Its Decision AB, option (b).** Added: 5.10 (the Shared_Guidance marks its Backend_Passages) and
  7.9 (the Repository_Check covers the Shared_Guidance and the Specification_Templates). Glossary:
  Specification_Templates. Verification caveat (a listing of folder names). Boundary Context, In
  scope, Out of scope and Adjacent expectations. Row Decision AB settled. The Skill map's preface.
- **The infrastructure's Decision 13, option (c).** No criterion. Row Decision N, infra Decision 13.
- **The Platform's questions 2 and 3 of Decision J and Decisions L, R to X and Z, and the
  infrastructure's Decisions 5 to 12.** Change nothing here.
- **Raised.** Nothing.
- **Still open.** Nothing: no decision of this document, and none of the decisions it inherits.

### Skill-map corrections, 16 October 2026

Written on 16 October 2026. The design (`design.md`), read against the default branch as the
verification caveat requires, found three rows of the Skill_Map whose treatment cannot meet the
criteria. The maintainer was asked to approve two skill-map corrections and answered "approve both
skill-map corrections". No criterion was added, reworded, withdrawn or renumbered, no dependency row
changed, and no decision was raised; the document stands at 7 requirements and 68 criteria, 66 live.

- **`worker-messaging`: from unchanged to "both paths, chosen by backend", with an Engine passage
  only.** It is the only Skill a worker repository installs, so criteria 5.7 (the Engine_URL and the
  worker's own Worker_Token from `DAAS_TOKEN`) and 5.9 (what the Worker_Account may and may not do)
  can only be met in it. Its Supabase text stays as it is outside the markers; the Engine passage
  is added. Its dependence stays "none": nothing in it works only with a per-project Supabase.
  Because it is no longer unchanged, criterion 2.2 no longer holds it identical to the
  Baseline_Revision.
- **`grant-module-access` and `references`: from "reworded to be true for both" to "both paths,
  chosen by backend".** Both hold guard-pattern text (an Invalid_Instruction of Requirement 3
  criterion 1) that no rewording makes true for both kinds of project, so criterion 5.2 cannot be
  met for them; each is given a Supabase passage and, where an Engine statement stands in its place,
  an Engine passage.
- **Alignment, not a new choice: the microfrontend Skills.** `add-microfrontend` and
  `add-microfrontend-zones` hand one session to several holders, which needs Decision Y's PP-35
  (row Decision Y, PP-35 under Dependencies). While PP-35 is unmet, Requirement 4 criterion 7 already
  requires each to state that it is not yet available on an Engine_Project and to give no steps for
  it. Their rows now say so; their treatment stays "both paths, chosen by backend", the Engine
  passage being that statement until PP-35 is met.
- **Not moved.** `generate-docs` stays unchanged; the links its files hold that break in a Kit are
  recorded by the design and the Platform's design as recorded link breaks, not marked.
- **Counts.** Treatment: both paths chosen by backend 22 to 25; reworded 18 to 16; unchanged 21 to
  20. Dependence is unchanged.
- **Alignment, not a new choice: `hooks-extensions` and `manage-scope`.** Read line by line, the
  steps for an Engine_Project differ from the Supabase_Project steps in 70% of `hooks-extensions`
  and 61% of `manage-scope`, so Requirement 5 criterion 3 already requires each to keep the two as
  separate file sets, each complete without the other. Their rows now say "a separate Engine file
  set"; `daas-platform`, at 44%, stays in-file. The maintainer approved all three designs on 16
  October 2026 ("approve all three designs when the pass is done") with the design that applies
  this (its Issue 9). Counts: both paths 25 to 23; a separate Engine file set 1 to 3.

## Skill map

Read on 13 October 2026, as the verification caveat says. *Dependence* is how much of the folder
works only with a per-project Supabase. *Treatment* is what the two readers proposed after the
second had corrected the first. Decision Q, settled for option (g), gives "both paths, chosen by
backend" the form of two Backend_Passages and "a separate Engine file set" the form of a file set
marked as one; it changes no substance. The Specification_Templates, which the Platform's Decision AB
makes this repository's, lie inside three of the Skills below (`buildpad-spec-init`,
`buildpad-steering` and `buildpad-steering-custom`) and are classified with them.
*Size* is the readers' estimate of the work in this repository alone. Amended 16 October 2026 with
the maintainer's approval (see [Skill-map corrections, 16 October 2026](#skill-map-corrections-16-october-2026)):
the rows `worker-messaging`, `grant-module-access` and `references`, and the treatment of the two
microfrontend Skills while PP-35 is unmet.

| Folder | Dependence | Treatment | Size |
|---|---|---|---|
| `add-external-oauth` | core | says unavailable on the Engine and stops | small |
| `create-api-route` | core | a separate Engine file set | large |
| `create-migration` | core | says unavailable on the Engine and stops | small |
| `add-buildpad` | partial | both paths, chosen by backend | small |
| `add-cron` | partial | both paths, chosen by backend | small |
| `add-files` | partial | both paths, chosen by backend | small |
| `add-i18n` | partial | both paths, chosen by backend | medium |
| `add-microapp` | partial | both paths, chosen by backend | medium |
| `add-microfrontend` | partial | both paths, chosen by backend; on the Engine, not yet available while Decision Y's PP-35 is unmet (4.7) | medium |
| `add-microfrontend-zones` | partial | both paths, chosen by backend; on the Engine, not yet available while Decision Y's PP-35 is unmet (4.7) | small |
| `add-users` | partial | reworded to be true for both | small |
| `add-workflows` | partial | both paths, chosen by backend | small |
| `agents` | partial | both paths, chosen by backend | small |
| `authentication-proxy` | partial | reworded to be true for both | small |
| `buildpad-reference` | partial | reworded to be true for both | small |
| `create-collection` | partial | both paths, chosen by backend | medium |
| `create-cron` | partial | both paths, chosen by backend | medium |
| `create-feature` | partial | reworded to be true for both | small |
| `create-project` | partial | both paths, chosen by backend | medium |
| `create-rbac` | partial | both paths, chosen by backend | medium |
| `create-service` | partial | both paths, chosen by backend | medium |
| `create-tests` | partial | both paths, chosen by backend | medium |
| `create-workflow` | partial | both paths, chosen by backend | medium |
| `daas-platform` | partial | both paths, chosen by backend | large |
| `debugging-and-error-recovery` | partial | both paths, chosen by backend | small |
| `grant-module-access` | partial | both paths, chosen by backend (amended 16 October 2026) | small |
| `hooks-extensions` | partial | a separate Engine file set | large |
| `manage-scope` | partial | a separate Engine file set | large |
| `references` | partial | both paths, chosen by backend (amended 16 October 2026) | small |
| `relational-permissions` | partial | both paths, chosen by backend | small |
| `security-and-hardening` | partial | both paths, chosen by backend | small |
| `add-multitenancy` | wording only | reworded to be true for both | small |
| `buildpad-steering-custom` | wording only | reworded to be true for both | small |
| `context-engineering` | wording only | reworded to be true for both | small |
| `create-form-builder` | wording only | reworded to be true for both | small |
| `idea-refine` | wording only | reworded to be true for both | small |
| `incremental-implementation` | wording only | reworded to be true for both | small |
| `performance-optimization` | wording only | reworded to be true for both | none |
| `planning-and-task-breakdown` | wording only | reworded to be true for both | small |
| `review-code` | wording only | reworded to be true for both | small |
| `spec-driven-development` | wording only | reworded to be true for both | small |
| `subagent-delegation` | wording only | reworded to be true for both | small |
| `buildpad-steering` | none | reworded to be true for both | small |
| `worker-messaging` | none | both paths, chosen by backend, with an Engine passage only (amended 16 October 2026) | small |
| `add-mobile-app` | none | new skill, true for both kinds of project (wraps the deployed web app; no backend-specific step) | small |
| `add-mcp-server` | none | new skill, true for both kinds of project (the MCP route forwards the caller's own token to the data API; no backend-specific step) | small |
| `migrate-to-engine` | partial | new skill, both paths, chosen by backend: on an Engine project it ports the automation and app code of a project moved from Supabase; on a Supabase project it says the skill applies after the move and stops | medium |

Unchanged, with no dependence found (20): `amplify-env-vars`, `buildpad-debug`, `buildpad-discovery`, `buildpad-impl`, `buildpad-review`, `buildpad-spec-batch`, `buildpad-spec-design`, `buildpad-spec-init`, `buildpad-spec-quick`, `buildpad-spec-requirements`, `buildpad-spec-status`, `buildpad-spec-tasks`, `buildpad-validate-design`, `buildpad-validate-gap`, `buildpad-validate-impl`, `buildpad-verify-completion`, `code-simplification`, `create-component`, `generate-docs`, `git-workflow-and-versioning`.

Counts: 64 folders. Dependence: core 3, partial 28, wording only 11, none 22. Treatment: both
paths chosen by backend 23 (two of them, the microfrontend Skills, say on the Engine that they are
not yet available while PP-35 is unmet), reworded 16, unchanged 20, unavailable on the Engine 2, a
separate Engine file set 3 (amended 16 October 2026; before it: 22, 18, 21, 2 and 1; then 25, 16,
20, 2 and 1 before the alignment under criterion 5.3).
