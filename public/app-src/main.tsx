import React from "react";

import { loadWorkspace, watchRole } from "./workspace";
import { mount, mountReady } from "./mounting";
import { AccountBrandingPanel } from "./screens/account/AccountBrandingPanel";
import { AccountIdentityHeaderCard, AccountCodeCard } from "./screens/account/AccountIdentityHeaderPanel";
import { AccountCoachCodePanel } from "./screens/account/AccountCoachCodePanel";
import { AccountCoachInvitationsPanel } from "./screens/account/AccountCoachInvitationsPanel";
import { AthleteCoachingRequestsPanel } from "./screens/account/AthleteCoachingRequestsPanel";
import { AccountCoachRelationshipPanel } from "./screens/account/AccountCoachRelationshipPanel";
import { AccountDataRightsPanel } from "./screens/account/AccountDataRightsPanel";
import { AccountIdentityPanel } from "./screens/account/AccountIdentityPanel";
import { NotificationBellPanel } from "./screens/account/NotificationBellPanel";
import { AccountOrgContextPanel } from "./screens/account/AccountOrgContextPanel";
import { TeamRosterPanel } from "./screens/account/TeamRosterPanel";
import { AccountOrgMessagesPanel } from "./screens/account/AccountOrgMessagesPanel";
import { CoachOrgMessagesPanel } from "./screens/account/CoachOrgMessagesPanel";
import { AccountSupportPanel } from "./screens/account/AccountSupportPanel";
import { CommercialPanel } from "./screens/account/CommercialPanel";
import { VerifyEmailPrompt } from "./screens/account/VerifyEmailPrompt";
import { EntryAuthPanel } from "./screens/entry/EntryAuthPanel";
import { BarbellCalculatorPanel } from "./screens/tools/BarbellCalculatorPanel";
import { capturePendingCoachFromUrl } from "./utils/pendingCoach";

// DEV NOTE: what every account uses, signed in or out. The athlete's and the
// coach's own screens are in athlete.tsx and coach.tsx (workspace.ts).

// A coach's share link opens /app/?coach=<slug> - keep it before anything renders.
capturePendingCoachFromUrl();

mount("entry-auth-root", <EntryAuthPanel />);
mount("verify-email-prompt-root", <VerifyEmailPrompt />);
mount("barbell-calculator-root", <BarbellCalculatorPanel />);
mount("account-identity-header-root", <AccountIdentityHeaderCard />);
mount("account-code-root", <AccountCodeCard />);
mount("account-identity-root", <AccountIdentityPanel />);
mount("notification-bell-root", <NotificationBellPanel />);
mount("account-data-rights-root", <AccountDataRightsPanel />);
mount("account-support-root", <AccountSupportPanel />);
mount("account-branding-root", <AccountBrandingPanel />);
// Back from Stripe's checkout: it reads the result from the address.
mount("account-commercial-root", <CommercialPanel />, { now: window.location.search !== "" });
mount("account-coach-invitations-root", <AccountCoachInvitationsPanel />);
mount("account-coach-relationship-root", <AccountCoachRelationshipPanel />);
mount("account-coaching-requests-root", <AthleteCoachingRequestsPanel />);
mount("account-coach-code-root", <AccountCoachCodePanel />);
mount("account-org-messages-root", <AccountOrgMessagesPanel />);
mount("account-org-context-root", <AccountOrgContextPanel />);
mount("coach-org-messages-root", <CoachOrgMessagesPanel />);
mount("account-team-roster-root", <TeamRosterPanel />);

watchRole();
void loadWorkspace();
mountReady();
document.addEventListener("kolosseum:view-shown", mountReady);
document.addEventListener("kolosseum:account-role-known", mountReady);
// Anything shown some other way (a tab, sign-in, a section opened by hand).
new MutationObserver(mountReady).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
