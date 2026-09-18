# DHIS2 country integration

This guide describes the supported production connection between one VaxPlan tenant and its country-specific DHIS2 instance. VaxPlan currently supports DHIS2 aggregate exchange; it does not implement individual-level DHIS2 Tracker synchronization.

## Supported scope

| Direction | Capability |
| --- | --- |
| DHIS2 → VaxPlan | Facility organisation units, routine immunization coverage, and population denominators |
| VaxPlan → DHIS2 | Aggregate immunization data values and approved microplanning achievement indicators |
| Validation | Credential, DHIS2 version, root organisation unit, data set, facility level, and local facility mappings |

The connector is tenant-specific. Each country tenant maintains its own endpoint, root organisation unit, data set, facility level, authentication scheme, and secret reference.

## Access and authorization

Open **Administration → HIS Integrations**, or navigate directly to `/his-integrations`.

- The tenant `interop` module must be enabled.
- The user needs `his_integrations.view` or `his_integrations.manage` to open the workspace.
- National administrators can add and edit connections.
- Server-side integration operations accept `national_admin` and `gis_specialist` roles.

## Prerequisites

Obtain the following from the country DHIS2 administrator:

1. The HTTPS base URL, with or without the trailing `/api`.
2. A least-privilege service credential.
3. The country/root organisation-unit UID.
4. The facility organisation-unit level.
5. The routine immunization data-set UID.
6. Data-element UIDs for every antigen or indicator that will be exchanged.
7. DHIS2 organisation-unit UIDs for VaxPlan facilities.

The service account should have read access to system information, organisation units, the configured data set, and required analytics. Grant data-value write access only when outbound synchronization is required.

## Configure the credential

Credentials are never stored in tenant settings. Add the credential to the server environment using a country-specific variable, for example:

```text
HIS_DHIS2_COUNTRY_TOKEN=replace-with-country-dhis2-token
```

Enter only the variable name, `HIS_DHIS2_COUNTRY_TOKEN`, in VaxPlan. Restart the server after changing its environment.

Supported authentication schemes are:

- **Personal access token:** VaxPlan sends `Authorization: ApiToken …`.
- **Basic:** the environment value contains the Base64 credential payload.
- **Bearer:** the environment value contains the bearer token.

If the stored value already starts with `ApiToken`, `Basic`, or `Bearer`, VaxPlan preserves it.

## Configure the tenant connection

1. Open **HIS Integrations** and select **Add Connection Setup**.
2. Select **DHIS2 Aggregate Web API**.
3. Enter a descriptive country connection label and the DHIS2 base URL.
4. Enter the environment-variable name containing the credential.
5. Enter the country/root organisation-unit UID, immunization data-set UID, and facility OU level.
6. Select the authentication scheme and activate the connection.
7. Save, hover over the integration card, and select **Test**.

The test is read-only. It calls DHIS2 system information and validates that the configured root organisation unit and data set exist. A configured status is not the same as a successful live test.

## Facility mapping

Every reporting facility must contain its DHIS2 organisation-unit UID in `facilities.external_ids`. Both keys below are accepted for compatibility:

```json
{ "dhis2": "DHIS2_OU_UID" }
```

```json
{ "dhis2_uid": "DHIS2_OU_UID" }
```

Use **Pull Facilities** to inspect organisation units below the configured country root. Verify mappings before importing or exporting data. VaxPlan fails closed when no facilities are mapped, and individual vaccination aggregates with no facility OU are skipped rather than posted to the national root.

## Data-element configuration

Routine antigen mappings use normalized environment-variable names:

```text
DHIS2_DE_BCG_UID=xxxxxxxxxxx
DHIS2_DE_PENTA1_UID=xxxxxxxxxxx
DHIS2_DE_MCV1_UID=xxxxxxxxxxx
```

Population import requires:

```text
DHIS2_DE_TOTAL_POP_UID=xxxxxxxxxxx
DHIS2_DE_UNDER1_POP_UID=xxxxxxxxxxx
```

Microplanning achievement export requires:

```text
DHIS2_DE_SESSIONS_PLANNED_UID=xxxxxxxxxxx
DHIS2_DE_SESSIONS_HELD_UID=xxxxxxxxxxx
DHIS2_DE_CHILDREN_TARGETED_UID=xxxxxxxxxxx
```

Missing required mappings stop the relevant production operation and return an explicit error. VaxPlan does not substitute placeholder UIDs or generated population values.

## Operating workflow

1. Use **Test** and resolve every failed check.
2. Use **Pull Facilities** and confirm country hierarchy and facility mappings.
3. Preview **Pull Coverage** or **Pull Target Pop** before committing data.
4. Reconcile warnings for unknown data elements or organisation units.
5. Run **Bi-Directional DHIS2 Sync** only after inbound previews are correct and outbound indicator mappings have been approved.
6. Review the audit log and returned counts after every production operation.

The bidirectional operation pulls coverage, pulls population denominators, and pushes microplanning achievements for the selected period. It is not a real-time client registry sync.

## Production safety behavior

- A missing credential is an error; it does not silently enable demo data.
- Simulation operates only when explicitly enabled in stored configuration and should not be used for production tenants.
- DHIS2 URLs are normalized so either `https://host` or `https://host/api` works.
- Organisation-unit pulls are limited to the configured root and facility level.
- Coverage and population records are matched only to facilities belonging to the active tenant.
- Non-DHIS2 connection types cannot be passed to DHIS2 import or synchronization endpoints.
- Connection tests and synchronization attempts are audited without recording credentials.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Integration menu missing | Tenant `interop` module and `his_integrations.view/manage` permission |
| No Token | Environment-variable name and server restart |
| HTTP 401/403 | Authentication scheme, credential value, and DHIS2 service-account authorities |
| Root OU or data set not found | UID correctness and sharing/access assigned to the service account |
| No facilities mapped | `externalIds.dhis2` or `externalIds.dhis2_uid` on tenant facilities |
| Coverage rows skipped | Antigen data-element mappings and facility OU mappings |
| Population import blocked | Population data-element environment variables |
| Achievement export blocked | Three microplanning achievement data-element variables |
| `/api/api` in an older deployment | Upgrade to the current connector; current versions normalize the base URL |

Do not enable outbound synchronization until the country DHIS2 team has approved the data set, data elements, category combinations, periods, and organisation-unit assignments.
