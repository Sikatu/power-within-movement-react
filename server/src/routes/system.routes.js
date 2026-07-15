const express = require('express')

const router = express.Router()

const modules = [
  {
    key: 'public_brand_layer',
    name: 'Public Brand Layer',
    status: 'active',
    description: 'Public website pages, service pathways, resources, contact flow, and booking entry points.',
  },
  {
    key: 'studio_dashboard',
    name: 'The Studio',
    status: 'active',
    description: 'Kim/admin command center for clients, bookings, follow-ups, Mail Studio, and activity visibility.',
  },
  {
    key: 'client_crm',
    name: 'Client Circle CRM',
    status: 'active',
    description: 'Client profiles, private notes, visible notes, service history, care timeline, resources, and portal invites.',
  },
  {
    key: 'native_scheduler',
    name: 'Sessions & Calendar',
    status: 'active',
    description: 'Appointment types, availability blocks, booking requests, client welcoming, and session workflow.',
  },
  {
    key: 'client_portal',
    name: 'Client Portal',
    status: 'active',
    description: 'Private client login, dashboard, sessions, follow-ups, service history, visible notes, and assigned resources.',
  },
  {
    key: 'asset_vault',
    name: 'Asset Vault',
    status: 'active',
    description: 'Private reusable uploads, folders, tags, versions, client assignments, and authenticated file delivery.',
  },
  {
    key: 'email_studio',
    name: 'Letters & Broadcasts',
    status: 'foundation_active',
    description: 'Mail templates, branded previews, client email drafting, provider-ready sending, and email activity logs.',
  },
  {
    key: 'founders_view',
    name: "Founder's View",
    status: 'active_owner_only',
    description: 'Owner-only business overview, ecosystem visibility, and high-level operating metrics.',
  },
  {
    key: 'courses',
    name: 'Learning Library',
    status: 'planned',
    description: 'Courses, modules, lessons, downloads, access rules, and progress tracking.',
  },
  {
    key: 'memberships',
    name: 'Membership Circle',
    status: 'planned',
    description: 'Membership tiers, member access, private resources, community spaces, and active/inactive status.',
  },
  {
    key: 'encouragements',
    name: 'Daily Encouragements',
    status: 'next_recommended',
    description: 'Kim-authored encouragements, announcements, group messages, and future client-visible inspiration feed.',
  },
  {
    key: 'community_circle',
    name: 'The Circle',
    status: 'future_layer',
    description: 'Invite-only private community, encouragement feed, profile privacy, moderation, and safe messaging.',
  },
  {
    key: 'developer_infrastructure',
    name: 'Developer & Infrastructure Layer',
    status: 'foundation_active',
    description: 'Health checks, launch readiness checks, environment status, technical diagnostics, and future Developer Control Center.',
  },
]

router.get('/blueprint', (req, res) => {
  res.json({
    platform: 'Power Within Collective Ecosystem',
    goal: 'One connected public website, private admin studio, client portal, community pathway, and infrastructure layer for Power Within Collective.',
    modules,
  })
})

module.exports = router