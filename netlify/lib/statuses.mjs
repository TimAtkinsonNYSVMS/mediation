// Mediation request statuses v01 (2026-11-06). The one list of stored status names (renamed from the Knack names in the
// staff redesign) and the map that reads the old Knack names, so a Phase 1 migration rerun before cutover still works.
export const STATUSES = ["Awaiting assignment", "Facilitator assigned", "Mediation in progress", "Waiting on the veterinarian", "Waiting on the owner",
  "Completed", "Closed without resolution"];
export const CLOSED = ["Completed", "Closed without resolution"];
export const LEGACY = {
  "Asking mediator to accept": "Awaiting assignment", "Mediator Assigned": "Facilitator assigned",
  "Mediator waiting for owner to respond": "Waiting on the owner", "Mediator waiting for veterinarian to respond": "Waiting on the veterinarian",
  "Withdrawn": "Closed without resolution"
};
export const normStatus = (s) => (s ? LEGACY[s] || s : s);
export const isOpen = (s) => !CLOSED.includes(normStatus(s) || "Awaiting assignment");
