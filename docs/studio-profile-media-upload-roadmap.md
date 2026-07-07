# Studio Profile + Media Uploads — Later Upgrade

This is intentionally reserved for a later phase.

## Future Studio Profile
The admin should eventually allow Kim / the owner to manage:
- profile photo
- display name
- bio / short welcome message
- signature line
- brand voice snippets
- public-facing contact details
- private studio preferences

## Future Upload System
The platform should eventually support uploads for:
- profile image
- course videos
- lesson downloads
- PDFs and resources
- member-only files
- encouragement images
- brand assets

## Recommended Future Technical Path
Build this after the main admin modules are stable:
1. Add media_files API upload endpoint.
2. Store files locally in development.
3. Store metadata in PostgreSQL.
4. Later migrate storage to a production object storage provider.
5. Add admin media library.
6. Connect uploads to courses, memberships, resources, and profile settings.

## UX Principle
Keep uploads simple:
- clear button
- preview before save
- plain labels
- no technical storage language shown to the client