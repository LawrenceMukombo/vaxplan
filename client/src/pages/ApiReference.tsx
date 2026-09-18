import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Code2, Search, Copy, Check, Terminal, Shield, ArrowRight,
  Database, Users, Globe, ClipboardList, Package, Share2, Layers,
  Lock, BookOpen, Key, Building2, Stethoscope, Sparkles, Activity,
  FileText, CheckCircle2, AlertTriangle, TrendingUp, Radio
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface APIParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface APIEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth: "Public" | "Authenticated" | "District Manager+" | "National Admin+" | "Platform Admin";
  description: string;
  params?: APIParam[];
  requestExample?: string;
  responseExample: string;
}

interface APIGroup {
  id: string;
  title: string;
  icon: any;
  description: string;
  endpoints: APIEndpoint[];
}

const API_GROUPS: APIGroup[] = [
  {
    id: "auth",
    title: "System & Authentication",
    icon: Key,
    description: "Session tokens, user profiles, cryptographic device authentication, and system telemetry.",
    endpoints: [
      {
        method: "GET",
        path: "/api/auth/user",
        auth: "Authenticated",
        description: "Fetch the active user profile session, including assigned role, permissions, home tenant, and geographic scope.",
        responseExample: `{
  "success": true,
  "data": {
    "id": 42,
    "firstName": "Dr. Sarah",
    "lastName": "Chola",
    "email": "sarah.chola@moh.gov.zm",
    "role": "provincial_coordinator",
    "provinceId": 3,
    "districtId": null,
    "facilityId": null,
    "tenantId": "tenant-zm-north",
    "permissions": ["view_reports", "approve_microplans", "manage_users"]
  }
}`
      },
      {
        method: "POST",
        path: "/api/auth/login",
        auth: "Public",
        description: "Authenticates user credentials, sets HTTP-only session cookie, and establishes tenant security context.",
        requestExample: `{
  "email": "sarah.chola@moh.gov.zm",
  "password": "••••••••••••"
}`,
        responseExample: `{
  "success": true,
  "message": "Signed in successfully",
  "data": {
    "id": 42,
    "email": "sarah.chola@moh.gov.zm",
    "role": "provincial_coordinator",
    "tenantId": "tenant-zm-north"
  }
}`
      },
      {
        method: "POST",
        path: "/api/auth/device-token",
        auth: "Authenticated",
        description: "Request a cryptographically signed API/device token used to authorize the offline Android client. Tokens are private and tenant-scoped.",
        requestExample: `{
  "deviceName": "Zebra TC26 Handheld",
  "purpose": "Routine Outreach Syncing"
}`,
        responseExample: `{
  "success": true,
  "data": {
    "tokenId": "tok_8f93a921",
    "tokenString": "vp_sec_7a2b9d4e1f83c09b882a...[truncated]",
    "createdAt": "2026-06-02T16:00:00.000Z",
    "expiresAt": "2027-06-02T16:00:00.000Z"
  }
}`
      },
      {
        method: "GET",
        path: "/api/auth/session-config",
        auth: "Public",
        description: "Retrieves idle session timeout and countdown warning duration configured for the tenant.",
        responseExample: `{
  "idleTimeoutMinutes": 15,
  "warningMinutes": 1
}`
      },
      {
        method: "POST",
        path: "/api/auth/ping",
        auth: "Authenticated",
        description: "Keep-alive endpoint called during active usage to extend server session lifetime without altering user idle preferences.",
        responseExample: `{
  "success": true,
  "timestamp": 1789643017000
}`
      },
      {
        method: "GET",
        path: "/api/version",
        auth: "Public",
        description: "Query active software build version, release timestamp, and Git commit hash.",
        responseExample: `{
  "version": "1.9.4",
  "builtAt": "2026-09-18T04:40:00.000Z",
  "environment": "production"
}`
      },
      {
        method: "GET",
        path: "/api/stats",
        auth: "Authenticated",
        description: "Aggregates overall tenant metrics for dashboard KPIs, including zero-dose children mapped, defaulters, and session completion rate.",
        responseExample: `{
  "success": true,
  "data": {
    "totalZeroDose": 1284,
    "totalDefaulters": 642,
    "activeMicroplansCount": 8,
    "sessionCompletionRate": 78.4,
    "totalImmunizedThisMonth": 4812
  }
}`
      },
      {
        method: "GET",
        path: "/api/presence/online-count",
        auth: "Authenticated",
        description: "Real-time count of active concurrent health workers and coordinators online within the active tenant.",
        responseExample: `{
  "onlineCount": 14,
  "activeSessions": 6
}`
      }
    ]
  },
  {
    id: "tenants",
    title: "Tenant & Multi-Country Governance",
    icon: Building2,
    description: "Tenant isolation, country configurations, multi-tenant switching, and ministry onboarding.",
    endpoints: [
      {
        method: "GET",
        path: "/api/me/tenant",
        auth: "Authenticated",
        description: "Retrieve active tenant organization profile, ISO country code, currency, and enabled feature modules.",
        responseExample: `{
  "success": true,
  "data": {
    "id": "tenant-zaf-national",
    "name": "Republic of South Africa National Department of Health",
    "countryCode": "ZAF",
    "currency": "ZAR",
    "settings": {
      "security": { "idleTimeoutMinutes": 15 },
      "modules": { "vgie": true, "supervision": true, "riskAssessment": true }
    }
  }
}`
      },
      {
        method: "POST",
        path: "/api/me/switch-tenant",
        auth: "Authenticated",
        description: "Switch active tenant workspace for authorized multi-country administrators or global partners.",
        requestExample: `{
  "tenantId": "tenant-zaf-national"
}`,
        responseExample: `{
  "success": true,
  "message": "Switched tenant successfully",
  "activeTenantId": "tenant-zaf-national"
}`
      },
      {
        method: "GET",
        path: "/api/public/tenants",
        auth: "Public",
        description: "List public onboarding tenants and ministries available for self-service pilot registration.",
        responseExample: `{
  "success": true,
  "data": [
    { "id": "tenant-zm-north", "name": "Zambia Ministry of Health", "countryCode": "ZMB" },
    { "id": "tenant-zaf-national", "name": "South Africa National Department of Health", "countryCode": "ZAF" },
    { "id": "tenant-ssd-national", "name": "South Sudan Ministry of Health", "countryCode": "SSD" },
    { "id": "tenant-png-national", "name": "Papua New Guinea National Department of Health", "countryCode": "PNG" }
  ]
}`
      },
      {
        method: "GET",
        path: "/api/admin/tenants",
        auth: "Platform Admin",
        description: "Enterprise management: list all system tenants with database isolation status, user counts, and tiers.",
        responseExample: `{
  "success": true,
  "data": [
    { "id": "tenant-zm-north", "name": "Zambia MoH", "countryCode": "ZMB", "tier": "enterprise", "activeUsers": 128 }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/admin/tenants",
        auth: "Platform Admin",
        description: "Provision a new country tenant with default administrative levels, GIS bounds, and seed vaccine schedules.",
        requestExample: `{
  "name": "Kenya Ministry of Health",
  "countryCode": "KEN",
  "currency": "KES",
  "adminEmail": "admin@health.go.ke"
}`,
        responseExample: `{
  "success": true,
  "message": "Tenant created successfully",
  "data": { "id": "tenant-ken-national", "countryCode": "KEN" }
}`
      }
    ]
  },
  {
    id: "geo",
    title: "Geography, Facilities & Population",
    icon: Globe,
    description: "Hierarchical administrative bounds, health facility GIS coordinates, catchments, WorldPop extraction, and remote sensing.",
    endpoints: [
      {
        method: "GET",
        path: "/api/provinces",
        auth: "Authenticated",
        description: "Lists all Level 1 administrative provinces/regions for the active tenant country.",
        responseExample: `{
  "success": true,
  "data": [
    { "id": 1, "name": "Gauteng", "code": "GP", "countryCode": "ZAF" },
    { "id": 2, "name": "KwaZulu-Natal", "code": "KZN", "countryCode": "ZAF" }
  ]
}`
      },
      {
        method: "GET",
        path: "/api/districts",
        auth: "Authenticated",
        description: "Lists Level 2 administrative districts. Optionally filter by parent province ID.",
        params: [
          { name: "provinceId", type: "number", required: false, description: "Filter districts belonging to a specific province" }
        ],
        responseExample: `{
  "success": true,
  "data": [
    { "id": 12, "name": "City of Johannesburg", "provinceId": 1, "targetPopulation": 5635000 }
  ]
}`
      },
      {
        method: "GET",
        path: "/api/facilities",
        auth: "Authenticated",
        description: "Retrieves health facilities with GPS locations, facility tiers, cold chain capacities, and catchment polygons.",
        params: [
          { name: "districtId", type: "number", required: false, description: "Filter facilities belonging to a specific district" }
        ],
        responseExample: `{
  "success": true,
  "data": [
    {
      "id": 104,
      "name": "Alexandra Health Centre",
      "districtId": 12,
      "facilityType": "health_centre",
      "latitude": -26.104,
      "longitude": 28.093,
      "targetPopulation": 14200
    }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/facilities",
        auth: "District Manager+",
        description: "Register a new health facility with verified coordinates and catchment area.",
        requestExample: `{
  "name": "Soweto Community Clinic",
  "districtId": 12,
  "facilityType": "clinic",
  "latitude": -26.248,
  "longitude": 27.854,
  "targetPopulation": 8500
}`,
        responseExample: `{
  "success": true,
  "message": "Facility registered successfully",
  "data": { "id": 108 }
}`
      },
      {
        method: "POST",
        path: "/api/population/estimate-polygon",
        auth: "Authenticated",
        description: "Extracts high-resolution population totals directly from WorldPop 100m/1km satellite raster grids inside any custom GeoJSON polygon or radius.",
        requestExample: `{
  "polygon": {
    "type": "Polygon",
    "coordinates": [[[28.08, -26.11], [28.11, -26.11], [28.11, -26.09], [28.08, -26.09], [28.08, -26.11]]]
  }
}`,
        responseExample: `{
  "success": true,
  "estimatedPopulation": 18450,
  "areaKm2": 4.82,
  "densityPerKm2": 3827.8,
  "source": "WorldPop 2020 100m constrained raster"
}`
      },
      {
        method: "GET",
        path: "/api/remote-sensing/gaps",
        auth: "Authenticated",
        description: "Retrieve satellite AI-detected settlement structures located >5km from any health facility (zero-dose candidate zones).",
        responseExample: `{
  "success": true,
  "count": 42,
  "features": [
    { "id": "gap_81", "latitude": -26.18, "longitude": 28.14, "estimatedStructures": 115, "distanceToNearestHfKm": 7.4 }
  ]
}`
      },
      {
        method: "GET",
        path: "/api/custom-layers",
        auth: "Authenticated",
        description: "List custom vector GIS layers and boundary shapefiles uploaded for the tenant.",
        responseExample: `{
  "success": true,
  "data": [
    { "id": 4, "name": "Informal Settlements 2026", "layerType": "geojson", "featureCount": 38 }
  ]
}`
      }
    ]
  },
  {
    id: "microplans",
    title: "Microplanning & Campaign Engine",
    icon: ClipboardList,
    description: "Target calculations, planning steps, budget summaries, multi-cadence periods, and approval workflows.",
    endpoints: [
      {
        method: "GET",
        path: "/api/microplans",
        auth: "Authenticated",
        description: "Lists microplans in user scope. Filter by status, planning cadence (monthly, quarterly, semi_annual, annual), or year.",
        params: [
          { name: "status", type: "string", required: false, description: "Filter: 'draft', 'pending_approval', 'approved', 'rejected'" },
          { name: "cadence", type: "string", required: false, description: "Filter: 'monthly', 'quarterly', 'semi_annual', 'annual'" },
          { name: "year", type: "number", required: false, description: "Planning cycle year (e.g. 2026, 2027)" }
        ],
        responseExample: `{
  "success": true,
  "data": [
    {
      "id": 7,
      "name": "Microplan Q3 2026 - Alexandra",
      "status": "approved",
      "planType": "routine",
      "planningCadence": "quarterly",
      "periodNumber": 3,
      "year": 2026,
      "targetPopulation": 14200,
      "createdAt": "2026-06-15T08:30:00Z"
    }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/microplans",
        auth: "District Manager+",
        description: "Creates a new microplan shell supporting Monthly, Quarterly, 6-Monthly, or Annual planning cadences with duplicate period prevention.",
        requestExample: `{
  "name": "Microplan Q3 2026 - Alexandra Health Centre",
  "facilityId": 104,
  "districtId": 12,
  "year": 2026,
  "quarter": 3,
  "planningCadence": "quarterly",
  "periodNumber": 3,
  "planType": "routine",
  "targetPopulation": 14200
}`,
        responseExample: `{
  "success": true,
  "message": "Microplan created successfully",
  "data": {
    "id": 14,
    "name": "Microplan Q3 2026 - Alexandra Health Centre",
    "status": "draft",
    "planningCadence": "quarterly"
  }
}`
      },
      {
        method: "GET",
        path: "/api/microplans/:id",
        auth: "Authenticated",
        description: "Retrieve comprehensive microplan document including all 10 wizard steps, session schedules, cold chain, and budgets.",
        responseExample: `{
  "success": true,
  "data": {
    "id": 14,
    "name": "Microplan Q3 2026 - Alexandra Health Centre",
    "status": "draft",
    "targetPopulation": 14200,
    "communitiesCount": 6,
    "sessionsCount": 18,
    "totalBudget": 42500
  }
}`
      },
      {
        method: "POST",
        path: "/api/microplans/:id/submit",
        auth: "Authenticated",
        description: "Submits completed microplan draft to district/provincial governance for review and formal approval.",
        requestExample: `{
  "submissionNotes": "Updated Q3 target with 2 new outreach posts for informal settlements."
}`,
        responseExample: `{
  "success": true,
  "message": "Microplan submitted for approval",
  "status": "pending_approval"
}`
      },
      {
        method: "POST",
        path: "/api/microplans/:id/approve",
        auth: "District Manager+",
        description: "Approves a submitted microplan, locking the target population, authorizing budgets, and scheduling field sessions.",
        responseExample: `{
  "success": true,
  "message": "Microplan approved successfully",
  "status": "approved"
}`
      },
      {
        method: "GET",
        path: "/api/campaign/readiness",
        auth: "Authenticated",
        description: "Retrieve country/province campaign readiness assessment across the 6 standard WHO domains (Planning, Logistics, Training, Comms, Supervision, Finance).",
        params: [
          { name: "provinceId", type: "number", required: false, description: "Filter by province" },
          { name: "campaignId", type: "string", required: false, description: "Campaign scope identifier" }
        ],
        responseExample: `{
  "success": true,
  "readinessScore": 84.5,
  "status": "ready",
  "domains": {
    "planning": 92,
    "logistics": 85,
    "training": 78,
    "communication": 90,
    "supervision": 82,
    "finance": 80
  }
}`
      }
    ]
  },
  {
    id: "sessions",
    title: "Session Scheduling & Routing",
    icon: Code2,
    description: "Session builder, daily operations, spatial proximity validation, and AI route optimization.",
    endpoints: [
      {
        method: "GET",
        path: "/api/sessions",
        auth: "Authenticated",
        description: "List scheduled fixed, outreach, and mobile sessions with GPS coordinates, target quotas, and session dates.",
        params: [
          { name: "microplanId", type: "number", required: false, description: "Scope to a specific microplan" },
          { name: "facilityId", type: "number", required: false, description: "Scope to a specific facility" }
        ],
        responseExample: `{
  "success": true,
  "data": [
    {
      "id": 142,
      "name": "Tsutsumani Outreach Post",
      "strategy": "outreach",
      "status": "scheduled",
      "sessionDate": "2026-07-15",
      "facilityId": 104,
      "targetInfants": 65,
      "latitude": -26.112,
      "longitude": 28.102
    }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/sessions",
        auth: "Authenticated",
        description: "Schedule a new immunization session with location coordinates, team staffing, and antigen allocation.",
        requestExample: `{
  "name": "Tsutsumani Outreach Post",
  "strategy": "outreach",
  "sessionDate": "2026-07-15",
  "facilityId": 104,
  "targetInfants": 65,
  "latitude": -26.112,
  "longitude": 28.102,
  "transportMode": "motorcycle"
}`,
        responseExample: `{
  "success": true,
  "message": "Session scheduled successfully",
  "data": { "id": 142 }
}`
      },
      {
        method: "POST",
        path: "/api/sessions/validate-proximity",
        auth: "Authenticated",
        description: "Validates whether a newly planned outreach location is within 5km of another scheduled session on the same date to avoid duplication.",
        requestExample: `{
  "latitude": -26.114,
  "longitude": 28.104,
  "sessionDate": "2026-07-15"
}`,
        responseExample: `{
  "success": true,
  "hasConflict": true,
  "conflicts": [
    { "sessionId": 142, "name": "Tsutsumani Outreach Post", "distanceKm": 0.32 }
  ]
}`
      }
    ]
  },
  {
    id: "clients",
    title: "Client Registry & Defaulters",
    icon: Users,
    description: "Child longitudinal logbook, zero-dose tracking, vaccination passport, and automated SMS reminders.",
    endpoints: [
      {
        method: "GET",
        path: "/api/clients",
        auth: "Authenticated",
        description: "Search registered children. Supports fuzzy name matching, national ID lookup, and risk level filtering.",
        params: [
          { name: "search", type: "string", required: false, description: "Fuzzy search by child or caregiver name" },
          { name: "risk", type: "string", required: false, description: "Filter: 'zero_dose', 'dropout', 'fully_immunized'" }
        ],
        responseExample: `{
  "success": true,
  "data": [
    {
      "id": 1084,
      "firstName": "Thabo",
      "lastName": "Molefe",
      "birthDate": "2025-11-04",
      "caregiverName": "Nomsa Molefe",
      "caregiverPhone": "+27821234567",
      "riskStatus": "dropout",
      "dosesAdministered": 3
    }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/clients/:id/vaccinate",
        auth: "Authenticated",
        description: "Records administration of an antigen dose, automatically updating child risk status and computing next appointment.",
        requestExample: `{
  "antigenCode": "HEXAXIM-1",
  "administeredDate": "2026-07-02",
  "facilityId": 104,
  "batchNumber": "HEX_8921A"
}`,
        responseExample: `{
  "success": true,
  "message": "Vaccination recorded successfully",
  "data": {
    "vaccinationId": 4821,
    "nextScheduledDose": "2026-08-02",
    "nextAntigen": "HEXAXIM-2"
  }
}`
      },
      {
        method: "GET",
        path: "/api/defaulters",
        auth: "Authenticated",
        description: "Lists defaulters and zero-dose infants who missed scheduled appointment windows, prioritized by days overdue.",
        responseExample: `{
  "success": true,
  "count": 18,
  "data": [
    { "clientId": 1084, "name": "Thabo Molefe", "missedAntigen": "HEXAXIM-2", "daysOverdue": 24 }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/defaulters/sms-reminder",
        auth: "District Manager+",
        description: "Sends an automated multilingual SMS appointment reminder to caregiver mobile phones.",
        requestExample: `{
  "clientId": 1084,
  "template": "routine_catchup_reminder"
}`,
        responseExample: `{
  "success": true,
  "message": "SMS dispatched to +27821234567"
}`
      }
    ]
  },
  {
    id: "stock",
    title: "Vaccine Cold Chain & Stock",
    icon: Package,
    description: "Antigen ledger balances, wastage rates, stock transfers, and AI demand forecasting.",
    endpoints: [
      {
        method: "GET",
        path: "/api/stock/ledger",
        auth: "Authenticated",
        description: "View real-time antigen balances, minimum safety thresholds, and stock status across facilities.",
        params: [
          { name: "facilityId", type: "number", required: true, description: "Scope to a specific facility cold store" }
        ],
        responseExample: `{
  "success": true,
  "data": [
    { "antigen": "BCG", "availableDoses": 420, "vialsCount": 21, "minThreshold": 100, "status": "adequate" },
    { "antigen": "OPV", "availableDoses": 80, "vialsCount": 4, "minThreshold": 150, "status": "understocked_alert" }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/stock/transaction",
        auth: "Authenticated",
        description: "Record stock receipts, administration consumption, or discarded damaged/expired vials.",
        requestExample: `{
  "facilityId": 104,
  "antigen": "HEXAXIM",
  "transactionType": "usage",
  "doses": 45,
  "batchNumber": "HEX_8921A"
}`,
        responseExample: `{
  "success": true,
  "message": "Stock transaction recorded",
  "newBalance": 375
}`
      },
      {
        method: "POST",
        path: "/api/stock/transfer",
        auth: "District Manager+",
        description: "Log inter-facility or depot-to-clinic stock transfers with digital delivery verification.",
        requestExample: `{
  "sourceFacilityId": 104,
  "destFacilityId": 105,
  "antigen": "OPV",
  "dosesCount": 100,
  "batchNumber": "V892"
}`,
        responseExample: `{
  "success": true,
  "message": "Transfer logged and inventory balances updated dynamically"
}`
      },
      {
        method: "GET",
        path: "/api/cold-chain/inventory",
        auth: "Authenticated",
        description: "Lists cold chain refrigeration assets, solar drives, and temperature logging history.",
        responseExample: `{
  "success": true,
  "data": [
    { "id": 12, "model": "B Medical TCW40SDD", "type": "solar_direct_drive", "capacityLitres": 45, "status": "functional" }
  ]
}`
      }
    ]
  },
  {
    id: "supervision",
    title: "Supportive Supervision & Checklists",
    icon: Stethoscope,
    description: "Facility supervision visits, structured WHO quality checklists, and action point monitoring.",
    endpoints: [
      {
        method: "GET",
        path: "/api/supervision-visits",
        auth: "Authenticated",
        description: "Retrieve facility supportive supervision assessments with scores, findings, and agreed action plans.",
        responseExample: `{
  "success": true,
  "data": [
    {
      "id": 88,
      "facilityId": 104,
      "supervisorName": "Dr. Sarah Chola",
      "visitDate": "2026-06-10",
      "compositeScore": 87.5,
      "openActionPoints": 2
    }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/supervision-visits",
        auth: "Authenticated",
        description: "Submit a completed supportive supervision assessment across cold chain, injection safety, data quality, and vaccine management.",
        requestExample: `{
  "facilityId": 104,
  "visitDate": "2026-06-10",
  "scores": { "coldChain": 90, "dataQuality": 85, "wasteManagement": 88 },
  "actionPoints": [
    { "action": "Calibrate fridge temperature sensor", "assignedTo": "Facility In-Charge", "dueDate": "2026-06-25" }
  ]
}`,
        responseExample: `{
  "success": true,
  "message": "Supervision visit recorded successfully",
  "data": { "id": 88 }
}`
      },
      {
        method: "GET",
        path: "/api/supervision-templates",
        auth: "Authenticated",
        description: "List active supervision checklist modules and weighted criteria configured for the tenant.",
        responseExample: `{
  "success": true,
  "data": [
    { "id": 1, "name": "Standard National Routine EPI Checklist", "totalQuestions": 32 }
  ]
}`
      }
    ]
  },
  {
    id: "risk",
    title: "VPD Risk Assessment & AI",
    icon: Sparkles,
    description: "Disease risk assessments, triangulated scoring (hazard, vulnerability, capacity), and automated AI microplan interventions.",
    endpoints: [
      {
        method: "GET",
        path: "/api/risk/assessments",
        auth: "Authenticated",
        description: "List VPD risk assessment workbooks by country, province, and target disease (Measles, Polio, Cholera).",
        responseExample: `{
  "success": true,
  "data": [
    {
      "id": 5,
      "title": "2026 National Measles Risk Assessment",
      "disease": "measles",
      "year": 2026,
      "status": "completed",
      "highRiskDistrictsCount": 14
    }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/risk/assessments/:id/calculate",
        auth: "District Manager+",
        description: "Executes the WHO VPD risk scoring algorithm across all districts, generating composite risk indices and categorized maps.",
        responseExample: `{
  "success": true,
  "message": "Risk indices calculated successfully",
  "data": {
    "districtsScored": 52,
    "veryHighRisk": 4,
    "highRisk": 10,
    "mediumRisk": 22,
    "lowRisk": 16
  }
}`
      },
      {
        method: "POST",
        path: "/api/ai/recommendations/generate",
        auth: "Authenticated",
        description: "Generates tailored operational interventions and session adjustments using AI models trained on local immunization data.",
        requestExample: `{
  "districtId": 12,
  "riskCategory": "high",
  "focusAntigens": ["MEASLES-1", "DTP3"]
}`,
        responseExample: `{
  "success": true,
  "recommendations": [
    {
      "priority": "high",
      "strategy": "mobile_outreach",
      "title": "Deploy weekend mobile team to informal settlements",
      "rationale": "High dropout between DTP1 and DTP3 observed in informal settlements."
    }
  ]
}`
      }
    ]
  },
  {
    id: "sync",
    title: "Offline Sync & HIS Interop (DHIS2)",
    icon: Share2,
    description: "Offline SQLite database replication for mobile tablets and national DHIS2 / OpenMRS data pipelines.",
    endpoints: [
      {
        method: "GET",
        path: "/api/sync/pull",
        auth: "Authenticated",
        description: "Pull down delta changes made in the cloud since the client's last sync sequence timestamp for offline-first operation.",
        params: [
          { name: "since", type: "string", required: true, description: "ISO timestamp of the client's last successful sync" }
        ],
        responseExample: `{
  "success": true,
  "data": {
    "clients": [
      { "id": 1084, "firstName": "Thabo", "lastName": "Molefe", "updatedAt": "2026-06-02T12:00:00Z" }
    ],
    "sessions": [],
    "stockTransactions": [],
    "serverTime": "2026-06-02T16:00:00Z"
  }
}`
      },
      {
        method: "POST",
        path: "/api/sync/batch",
        auth: "Authenticated",
        description: "Atomically uploads queued offline operations stored in field tablet SQLite outboxes.",
        requestExample: `{
  "deviceToken": "vp_sec_7a2b...",
  "operations": [
    {
      "action": "create_client",
      "tempId": "tmp_90211",
      "payload": { "firstName": "Lindiwe", "lastName": "Ndlovu", "birthDate": "2026-02-14" }
    }
  ]
}`,
        responseExample: `{
  "success": true,
  "processed": 1,
  "failed": 0,
  "idMap": {
    "tmp_90211": 1085
  }
}`
      },
      {
        method: "GET",
        path: "/api/his/instances",
        auth: "National Admin+",
        description: "List configured external Health Information Systems (DHIS2, eLMIS, OpenMRS) with sync statuses.",
        responseExample: `{
  "success": true,
  "data": [
    { "id": "dhis2-prod", "name": "National DHIS2 Production", "type": "dhis2", "status": "connected" }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/his/sync/execute",
        auth: "National Admin+",
        description: "Executes automated push of aggregated monthly immunization and microplan metrics directly to National DHIS2 Data Value Sets API.",
        requestExample: `{
  "instanceId": "dhis2-prod",
  "period": "202607",
  "orgUnitId": "OU_8921"
}`,
        responseExample: `{
  "success": true,
  "dhis2Response": {
    "imported": 48,
    "updated": 2,
    "ignored": 0,
    "status": "SUCCESS"
  }
}`
      }
    ]
  },
  {
    id: "research",
    title: "Surveillance, Research & Evidence",
    icon: Activity,
    description: "Event-based disease surveillance signals, operational research documents, and qualitative barrier evidence.",
    endpoints: [
      {
        method: "GET",
        path: "/api/surveillance/signals",
        auth: "Authenticated",
        description: "List active epidemiological surveillance signals, AFP alerts, and suspect outbreak reports.",
        responseExample: `{
  "success": true,
  "data": [
    { "id": 19, "disease": "measles", "clusterSize": 3, "facilityId": 104, "status": "investigating" }
  ]
}`
      },
      {
        method: "POST",
        path: "/api/surveillance/signals",
        auth: "Authenticated",
        description: "Submit a new community case signal or suspect disease cluster detected during field immunization.",
        requestExample: `{
  "disease": "measles",
  "suspectCases": 2,
  "facilityId": 104,
  "locationNotes": "Informal settlement Block C"
}`,
        responseExample: `{
  "success": true,
  "message": "Surveillance signal submitted and district alerted",
  "data": { "id": 20 }
}`
      },
      {
        method: "GET",
        path: "/api/research/articles",
        auth: "Authenticated",
        description: "Browse peer-reviewed vaccine equity publications, white papers, and operational research artifacts.",
        responseExample: `{
  "success": true,
  "data": [
    { "id": 1, "title": "Reaching Zero-Dose Children Through Spatial Microplanning in Sub-Saharan Africa", "year": 2026 }
  ]
}`
      },
      {
        method: "GET",
        path: "/api/planning-actions",
        auth: "Authenticated",
        description: "List prioritized microplan action items with status tracking, assignees, and target indicators.",
        responseExample: `{
  "success": true,
  "data": [
    { "id": 31, "title": "Engage community leaders in Ward 4", "status": "in_progress", "dueDate": "2026-07-20" }
  ]
}`
      }
    ]
  }
];

export default function ApiReference() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast({
      title: "Copied to clipboard",
      description: "Path/Payload has been successfully copied.",
      duration: 2000,
    });
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      case "POST":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "PUT":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
      case "PATCH":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "DELETE":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-500/10 text-foreground border-border/20";
    }
  };

  const getAuthBadgeClass = (auth: string) => {
    switch (auth) {
      case "Public":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-400";
      case "Authenticated":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
      case "District Manager+":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
      case "National Admin+":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      default:
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400";
    }
  };

  // Filter groups and endpoints
  const filteredGroups = API_GROUPS.map((group) => {
    if (selectedGroup !== "all" && group.id !== selectedGroup) return null;

    const filteredEndpoints = group.endpoints.filter((ep) => {
      const matchSearch =
        ep.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ep.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });

    if (filteredEndpoints.length === 0) return null;

    return {
      ...group,
      endpoints: filteredEndpoints
    };
  }).filter(Boolean) as APIGroup[];

  return (
    <div className="min-h-screen bg-background">
      {/* Dynamic Header */}
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-20 px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Terminal className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">API Documentation</h1>
              <p className="text-xs text-muted-foreground">
                REST Specifications &amp; offline synchronization protocols for integrators.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4 text-primary" />
            <span>Role-Based Access Control Active</span>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Left Column Sidebar */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
            <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
              <CardContent className="p-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search endpoints..."
                    className="pl-9 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="border-t border-border/50 pt-2" />

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-2">
                    Categories
                  </span>
                  <button
                    onClick={() => setSelectedGroup("all")}
                    className={`w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      selectedGroup === "all"
                        ? "bg-primary text-primary-foreground font-semibold shadow"
                        : "hover:bg-accent text-foreground/80"
                    }`}
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <span>All Endpoints</span>
                  </button>

                  {API_GROUPS.map((group) => {
                    const Icon = group.icon;
                    return (
                      <button
                        key={group.id}
                        onClick={() => setSelectedGroup(group.id)}
                        className={`w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          selectedGroup === group.id
                            ? "bg-primary text-primary-foreground font-semibold shadow"
                            : "hover:bg-accent text-foreground/80"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{group.title}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-indigo-500/20 bg-indigo-500/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  <Lock className="h-4 w-4" />
                  <span>Security Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  All requests must attach the `Cookie` session key or supply a generated device token in the `Authorization` header as:
                  <code className="block mt-1 p-1.5 rounded bg-muted/65 font-mono text-[10px] break-all">
                    Bearer vp_sec_...
                  </code>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column Endpoint Catalog */}
          <div className="lg:col-span-3 space-y-12">
            {filteredGroups.length === 0 ? (
              <Card className="border-border/60 bg-card/50 py-12">
                <CardContent className="text-center space-y-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold">No endpoints found</h3>
                  <p className="text-xs text-muted-foreground">
                    Try adjusting your search keywords or choosing a different category.
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredGroups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.id} className="space-y-6">
                    {/* Group Header */}
                    <div className="flex items-start gap-3 pb-3 border-b border-border/50">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <GroupIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-foreground">{group.title}</h2>
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                      </div>
                    </div>

                    {/* Endpoints */}
                    <div className="space-y-6">
                      {group.endpoints.map((ep, idx) => (
                        <Card key={idx} className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden hover:shadow-md transition-shadow">
                          {/* Endpoint title bar */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/20 px-4 py-3 border-b border-border/40">
                            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                              <Badge className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getMethodBadgeClass(ep.method)}`} variant="outline">
                                {ep.method}
                              </Badge>
                              <code className="text-xs md:text-sm font-mono font-bold text-foreground truncate break-all select-all">
                                {ep.path}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                                onClick={() => handleCopy(ep.path)}
                              >
                                {copiedText === ep.path ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                              <Badge className={`text-[10px] font-semibold ${getAuthBadgeClass(ep.auth)}`} variant="secondary">
                                {ep.auth}
                              </Badge>
                            </div>
                          </div>

                          <CardContent className="p-4 space-y-4">
                            <p className="text-xs leading-relaxed text-foreground/90">
                              {ep.description}
                            </p>

                            {/* Parameters */}
                            {ep.params && ep.params.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                  Parameters
                                </span>
                                <div className="border border-border/40 rounded-lg overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-muted/30 border-b border-border/40 font-semibold">
                                        <th className="px-3 py-2">Parameter</th>
                                        <th className="px-3 py-2">Type</th>
                                        <th className="px-3 py-2">Required</th>
                                        <th className="px-3 py-2">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                                      {ep.params.map((param, pIdx) => (
                                        <tr key={pIdx} className="hover:bg-muted/10">
                                          <td className="px-3 py-2 font-bold text-foreground">{param.name}</td>
                                          <td className="px-3 py-2 text-primary">{param.type}</td>
                                          <td className="px-3 py-2">
                                            {param.required ? (
                                              <span className="text-rose-600 dark:text-rose-400 font-bold">Yes</span>
                                            ) : (
                                              <span className="text-muted-foreground">No</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 font-sans font-normal text-muted-foreground">{param.description}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Examples */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                              {/* Request Payload */}
                              {ep.requestExample && (
                                <div className="md:col-span-6 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                      Example Request
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleCopy(ep.requestExample || "")}
                                    >
                                      {copiedText === ep.requestExample ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                  <pre className="p-3 rounded-lg bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 text-zinc-200 dark:text-zinc-300 font-mono text-[10.5px] leading-relaxed overflow-x-auto">
                                    <code>{ep.requestExample}</code>
                                  </pre>
                                </div>
                              )}

                              {/* Response Payload */}
                              <div className={`${ep.requestExample ? "md:col-span-6" : "md:col-span-12"} space-y-1.5`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                    Example Response (200 OK)
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleCopy(ep.responseExample)}
                                  >
                                    {copiedText === ep.responseExample ? (
                                      <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                                <pre className="p-3 rounded-lg bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 text-zinc-200 dark:text-zinc-300 font-mono text-[10.5px] leading-relaxed overflow-x-auto">
                                  <code>{ep.responseExample}</code>
                                </pre>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
