import React from 'react';
import { UIProvider, useUI } from './UIContext';
import { AuthProvider } from './AuthContext';
import { CommerceProvider } from './CommerceContext';
import { IntelligenceProvider } from './IntelligenceContext';
import { TripOsProvider } from './TripOsContext';
import { ItineraryProvider } from './ItineraryContext';
import { TripProvider } from './TripContext';

/**
 * Bridges UIContext's showToast into AuthProvider.
 *
 * AuthProvider guards every user-facing message with `if (showToast)`. Mounting
 * it without the prop meant all sign-in, registration and sign-out feedback —
 * including "wrong password" — was silently discarded. AuthProvider renders
 * below UIProvider, so the hook can only be read from a component in between.
 */
const AuthProviderWithToast: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast, navigateTo } = useUI();
  return (
    <AuthProvider
      showToast={showToast}
      // Signing out on a private page — /profile, /bookings, /my-trip — would
      // otherwise leave the traveler looking at the signed-out state of a page
      // that is no longer theirs to be on.
      onSignedOut={() => navigateTo('/home')}
    >
      {children}
    </AuthProvider>
  );
};

/**
 * Modular Root State Provider that composes decoupled sub-domain contexts
 * in strict hierarchical dependency order:
 *
 *  UIProvider (Navigation, routes, toasts, easy-mode, persona state)
 *    └── AuthProvider (User credentials, roles, cloud sync)
 *          └── CommerceProvider (Bookings, double-entry ledger, transfers)
 *                └── IntelligenceProvider (Suppliers, pricing, opportunities)
 *                      └── TripOsProvider (Fit score, trade-offs, health, readiness)
 *                            └── ItineraryProvider (Days, activities, food orders, bucket list)
 *                                  └── TripProvider (Unified facade & useTrip() bridge)
 */
export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <UIProvider>
      <AuthProviderWithToast>
        <CommerceProvider>
          <IntelligenceProvider>
            <TripOsProvider>
              <ItineraryProvider>
                <TripProvider>
                  {children}
                </TripProvider>
              </ItineraryProvider>
            </TripOsProvider>
          </IntelligenceProvider>
        </CommerceProvider>
      </AuthProviderWithToast>
    </UIProvider>
  );
};
