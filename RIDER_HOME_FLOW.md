# Rider Home Flow (Frontend Integration)

## Goal
Rider home screen should show:
1. Wallet balance
2. Ride history
3. Incoming nearby ride requests with `Accept` / `Decline`

## Backend APIs

### 1) Rider Home Summary
Endpoint:
1. `GET /api/v1/deliveries/rider/home`

Headers:
1. `Authorization: Bearer <token>`

Response contains:
1. `wallet.balance` and `wallet.balanceInNaira`
2. `rideHistory` (latest rides)
3. `incomingRideRequests` (searching requests near rider location)
4. Socket metadata/events for live updates

### 2) Accept Ride
Endpoint:
1. `POST /api/v1/deliveries/:id/accept`

Notes:
1. For match request cards, `:id` is `incomingRideRequests[n].id`.
2. Backend creates delivery and assigns rider.

### 3) Decline Ride
Endpoint:
1. `POST /api/v1/deliveries/match-requests/:id/decline`

Body (optional):
```json
{
  "reason": "Too far"
}
```

Notes:
1. Rider is added to request `declinedRiderIds`.
2. Rider will be excluded from rebroadcast for that match request.

### 4) Ride History List
Use:
1. `rideHistory` from home summary for initial render.
2. Optionally `GET /api/v1/deliveries/my-deliveries` for full list page.

## WebSocket Flow

## Connect
1. Connect socket with JWT in `auth.token`.
2. Rider is auto-marked online on socket connection.
3. Rider gets `rider_presence` event:
   - `{ status: "online", riderId }`

## Rider should emit location updates
1. Event: `update_location`
2. Payload:
```json
{
  "lat": 6.5244,
  "lng": 3.3792
}
```

## Incoming ride request event
1. Event: `incoming_match_request`
2. Show card on Home immediately with:
   - pickup/dropoff
   - package details
   - fee
   - action buttons (`Accept`, `Decline`)

## When another rider takes it
1. Event: `match_request_taken`
2. Remove that request card if `matchRequestId` matches a visible card.

## Suggested Home UI Behavior
1. On screen open:
   - call `GET /api/v1/deliveries/rider/home`
   - render wallet + history + open incoming requests
2. Keep socket connected while app session is active.
3. Add incoming requests into current list when `incoming_match_request` arrives.
4. On `Accept` success:
   - remove request card
   - move to active ride state
5. On `Decline` success:
   - remove request card
6. On app background/offline toggle:
   - emit `toggle_online` if you want manual online/offline control.
