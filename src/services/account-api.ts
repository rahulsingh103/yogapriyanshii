import { json, request } from './api';
import type { AccountView, OfferSummary, OffersOverview } from '../types';

// api.ts's lazy half: only the account sheet, the unsubscribe page and the Offers tab use these, so
// they stay out of the homepage bundle (spec 14's budget). The header's one call, getAccount, is in api.ts.
export const accountApi = {
  async requestAccountCode(body: { intent: 'signup' | 'login'; email: string; offersOptIn: boolean; website: string }): Promise<{ success: boolean }> {
    return request('/api/account/request-code', json(body));
  },

  async verifyAccountCode(body: { email: string; code: string }): Promise<{ account: AccountView; created: boolean }> {
    return request('/api/account/verify', json(body));
  },

  async updateAccount(body: { offersOptIn: boolean }): Promise<{ account: AccountView }> {
    return request('/api/account/update', json(body));
  },

  async logoutAccount(): Promise<void> {
    await request('/api/account/logout', json({}));
  },

  async unsubscribeOffers(token: string): Promise<void> {
    await request(`/api/offers/unsubscribe?token=${encodeURIComponent(token)}`, { method: 'POST' });
  },

  async getOffers(token: string): Promise<OffersOverview> {
    return request('/api/admin/offers', { headers: { Authorization: `Bearer ${token}` } });
  },

  async createOffer(token: string, body: { subject: string; body: string }): Promise<{ offer: OfferSummary }> {
    return request('/api/admin/offers', json(body, token));
  },

  async sendOfferBatch(token: string, id: string): Promise<{ offer: OfferSummary; paused: boolean }> {
    return request(`/api/admin/offers/${encodeURIComponent(id)}/send-batch`, json({}, token));
  },
};
