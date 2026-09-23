# DUF Audit Criteria Checklist

Every item must be checked for every view in the target app.

## Data Relevance (D)

- [ ] D1: Every data element shown is relevant to the current view context (not ecosystem-wide when viewing a single item)
- [ ] D2: Data labels match what the data actually represents
- [ ] D3: No hardcoded/placeholder data in production code (except clearly marked defaults)
- [ ] D4: Counts, scores, and KPIs are computed from real data sources, not stub values
- [ ] D5: Timestamps and dates are real, not hardcoded
- [ ] D6: Filter/sort controls affect the actual displayed data
- [ ] D7: Search functionality queries real data, not local mock arrays

## UX Functionality (U)

- [ ] U1: Every button has a working click handler
- [ ] U2: Every form submits to a real endpoint and handles the response
- [ ] U3: Empty states show a meaningful message (not blank space)
- [ ] U4: Error states surface the actual error, not generic messages
- [ ] U5: Loading states exist for async operations
- [ ] U6: Modal/dialog open and close correctly
- [ ] U7: Navigation between views preserves expected state
- [ ] U8: Destructive actions have confirmation UX

## Frontend-Backend Wiring (F)

- [ ] F1: Every frontend API call has a matching backend endpoint
- [ ] F2: Every backend endpoint that serves UI data has at least one frontend consumer
- [ ] F3: Request payload shape matches what the endpoint expects
- [ ] F4: Response shape matches what the frontend parses
- [ ] F5: Error response format is consistent and the frontend handles it
- [ ] F6: Auth headers are sent when required
- [ ] F7: CORS configuration allows the frontend origin
- [ ] F8: Timeout values are appropriate for the operation

## Backend Data Integrity (B)

- [ ] B1: Every endpoint queries a real data source (not returning hardcoded JSON)
- [ ] B2: Database tables referenced in queries actually exist
- [ ] B3: Foreign key relationships are valid
- [ ] B4: Proxy/relay endpoints handle upstream failures visibly (not silent empty responses)
- [ ] B5: Environment variables required for data sources are documented
- [ ] B6: Migrations are up to date with the schema code references

## Silent Failure Detection (S)

- [ ] S1: No catch blocks that return HTTP 200 with empty data on connection errors
- [ ] S2: No catch blocks that swallow exceptions without logging
- [ ] S3: No endpoints that return different HTTP status for the same error type
- [ ] S4: Error responses include an error_type or error code the frontend can branch on
- [ ] S5: Health check endpoints exist for critical dependencies
