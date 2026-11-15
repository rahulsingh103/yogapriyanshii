import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { getConfig } from './config.js';
import { getDb } from './db.js';
import { cancelBooking, createBooking, createLegacyWheelBooking, getBookingByToken } from './bookings.js';
import { submitContact } from './contact.js';
import { login, logout, requireAdmin, resetAdminLockout, saveSettings, stats } from './admin.js';
import { listMembers, parseMembersQuery, updateMember } from './membership.js';
import { RETIRED_CLASS_ID, createAdhocSession, createLegacyWheelOrphans, listSchedule, setUnmigratedTemplate } from './schedule.js';
import { testOutbox } from './email.js';
import {
  ACCOUNTS_UNAVAILABLE,
  accountTestHelpers,
  accountWriteGuard,
  clearedSessionCookie,
  currentAccount,
  logoutAccount,
  requestCode,
  sessionCookie,
  updateAccount,
  verifyCode,
} from './accounts.js';
import {
  OFFERS_UNAVAILABLE,
  createOffer,
  interruptOneRecipientForTests,
  isUnsubscribeToken,
  offersOverview,
  sendOfferBatch,
  setOfferDailyLimitForTests,
  unsubscribe,
} from './offers.js';
import { clientIp } from './rate-limit.js';
import { HttpError, UUID_RE, bad, normalizeEmail } from './validate.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;

/** Express 4 doesn't catch rejected promises; this forwards them to the error handler. */
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};

const bodyOf = (req: Request): Record<string, unknown> =>
  req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};

/** The tables arrive with migration 006: if the code deploys first, a friendly 503 instead of a 500. */
const needsTables = (message: string, fn: Handler): Handler => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    throw /no such table/i.test((err as Error)?.message ?? '') ? new HttpError(503, message) : err;
  }
};
const accountHandler = (fn: Handler) => wrap(needsTables(ACCOUNTS_UNAVAILABLE, fn));
const offersHandler = (fn: Handler) => wrap(needsTables(OFFERS_UNAVAILABLE, fn));

const noStore = (_req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export function buildRouter(): express.Router {
  const r = express.Router();

  r.get(
    '/api/health',
    wrap(async (_req, res) => {
      const cfg = getConfig();
      let database: 'ok' | 'not_configured' | 'error' = 'not_configured';
      if (cfg.db.kind !== 'none') {
        try {
          await (await getDb()).execute('SELECT 1');
          database = 'ok';
        } catch {
          database = 'error';
        }
      }
      // Public: only whether the database answers. Nothing about email or admin set-up.
      res.status(database === 'ok' ? 200 : 503).json({ ok: database === 'ok', database });
    })
  );

  r.get(
    '/api/classes',
    wrap(async (_req, res) => {
      const db = await getDb();
      const rs = await db.execute({
        sql: 'SELECT id, name, level, duration_min, description FROM classes WHERE id <> ? ORDER BY sort_order LIMIT 20',
        args: [RETIRED_CLASS_ID],
      });
      res.json({
        classes: rs.rows.map((c) => ({
          id: String(c.id),
          name: String(c.name),
          level: String(c.level),
          duration: Number(c.duration_min),
          description: String(c.description),
          // classes.style is legacy (docs/DATABASE.md): the class id is the style.
          style: String(c.id),
        })),
      });
    })
  );

  r.get(
    '/api/schedule',
    wrap(async (_req, res) => {
      res.json({ sessions: await listSchedule() });
    })
  );

  r.post(
    '/api/bookings',
    wrap(async (req, res) => {
      res.status(201).json(await createBooking(bodyOf(req)));
    })
  );

  // Must come before '/api/bookings/:token'.
  r.post(
    '/api/bookings/cancel',
    wrap(async (req, res) => {
      res.json(await cancelBooking(bodyOf(req).bookingToken));
    })
  );

  r.get(
    '/api/bookings/:token',
    wrap(async (req, res) => {
      res.json(await getBookingByToken(req.params.token));
    })
  );

  r.post(
    '/api/contact',
    wrap(async (req, res) => {
      res.json(await submitContact(bodyOf(req)));
    })
  );

  r.post(
    '/api/admin/login',
    wrap(async (req, res) => {
      res.json(await login(bodyOf(req)));
    })
  );

  r.post(
    '/api/admin/logout',
    wrap(async (req, res) => {
      res.json(await logout(req));
    })
  );

  r.get(
    '/api/admin/stats',
    requireAdmin,
    wrap(async (_req, res) => {
      res.json(await stats());
    })
  );

  r.post(
    '/api/admin/settings',
    requireAdmin,
    wrap(async (req, res) => {
      res.json(await saveSettings(bodyOf(req)));
    })
  );

  // Membership requests (Members tab): 20 per page, newest first, with a count per status.
  r.get(
    '/api/admin/members',
    requireAdmin,
    wrap(async (req, res) => {
      res.json(await listMembers(parseMembersQuery(req.query as Record<string, unknown>)));
    })
  );

  r.post(
    '/api/admin/members/:id',
    requireAdmin,
    wrap(async (req, res) => {
      res.json(await updateMember(req.params.id, bodyOf(req)));
    })
  );

  // Student accounts. Everything here carries the session, so nothing is cached and writes pass the CSRF guard.
  r.use('/api/account', noStore);

  r.post(
    '/api/account/request-code',
    accountWriteGuard,
    accountHandler(async (req, res) => {
      res.json(await requestCode(bodyOf(req), clientIp(req)));
    })
  );

  r.post(
    '/api/account/verify',
    accountWriteGuard,
    accountHandler(async (req, res) => {
      const { token, ...result } = await verifyCode(bodyOf(req), clientIp(req));
      res.set('Set-Cookie', sessionCookie(token, { secure: getConfig().secureCookies }));
      res.json(result);
    })
  );

  r.get(
    '/api/account/me',
    accountHandler(async (req, res) => {
      res.json(await currentAccount(req));
    })
  );

  r.post(
    '/api/account/update',
    accountWriteGuard,
    accountHandler(async (req, res) => {
      res.json(await updateAccount(req, bodyOf(req)));
    })
  );

  r.post(
    '/api/account/logout',
    accountWriteGuard,
    accountHandler(async (req, res) => {
      // The session row goes first: if that fails, the cookie stays and the student can try again.
      const result = await logoutAccount(req);
      res.set('Set-Cookie', clearedSessionCookie({ secure: getConfig().secureCookies }));
      res.json(result);
    })
  );

  // Offer emails: unsubscribing needs no login and no Origin, because mail clients POST it one-click.
  r.use('/api/offers', noStore);

  r.post(
    '/api/offers/unsubscribe',
    offersHandler(async (req, res) => {
      res.json(await unsubscribe(req.query.token));
    })
  );

  // The List-Unsubscribe link, for mail apps that open it. A GET never changes anything.
  r.get('/api/offers/unsubscribe', (req, res) => {
    const { token } = req.query;
    res.redirect(302, isUnsubscribeToken(token) ? `/unsubscribe?token=${token}` : '/unsubscribe');
  });

  r.get(
    '/api/admin/offers',
    requireAdmin,
    offersHandler(async (_req, res) => {
      res.json(await offersOverview());
    })
  );

  r.post(
    '/api/admin/offers',
    requireAdmin,
    offersHandler(async (req, res) => {
      res.json(await createOffer(bodyOf(req)));
    })
  );

  r.post(
    '/api/admin/offers/:id/send-batch',
    requireAdmin,
    offersHandler(async (req, res) => {
      res.json(await sendOfferBatch(req.params.id));
    })
  );

  // Test-only helpers: mounted only when APP_ENV=test and never on Vercel.
  const cfg = getConfig();
  if (cfg.testRoutes && cfg.mode === 'test' && !cfg.onVercel) {
    r.get('/api/test/outbox', (_req, res) => {
      res.json({ emails: testOutbox.list() });
    });
    r.post('/api/test/outbox/clear', (_req, res) => {
      testOutbox.clear();
      res.json({ success: true });
    });
    r.post('/api/test/email-fail', (req, res) => {
      testOutbox.setFailing(bodyOf(req).fail === true);
      res.json({ success: true });
    });
    // Clears the admin lockout so the lockout tests can each start from zero attempts.
    r.post(
      '/api/test/admin-unlock',
      wrap(async (_req, res) => {
        await resetAdminLockout();
        res.json({ success: true });
      })
    );
    // A session starting soon, for the late-cancellation rule (real sessions are hours or days away).
    r.post(
      '/api/test/session-soon',
      wrap(async (req, res) => {
        const minutes = Number(bodyOf(req).minutesFromNow);
        if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) throw bad('minutesFromNow must be 1–1440.');
        res.status(201).json({ session: await createAdhocSession(minutes) });
      })
    );
    // A booking on the retired class, as live may hold: the API no longer takes new ones.
    r.post(
      '/api/test/legacy-wheel-booking',
      wrap(async (req, res) => {
        const email = normalizeEmail(typeof bodyOf(req).email === 'string' ? (bodyOf(req).email as string) : '');
        if (!email) throw bad('email is required.');
        res.status(201).json(await createLegacyWheelBooking(email));
      })
    );
    // Empty retired-class sessions at future Thursdays, as live holds, for the schedule's LIMIT.
    r.post(
      '/api/test/legacy-wheel-orphans',
      wrap(async (_req, res) => {
        res.status(201).json(await createLegacyWheelOrphans());
      })
    );
    // The timetable before migration 005 ({ on: true }) and after it ({ on: false }).
    r.post(
      '/api/test/unmigrated-template',
      wrap(async (req, res) => {
        const { on } = bodyOf(req);
        if (typeof on !== 'boolean') throw bad('on must be true or false.');
        await setUnmigratedTemplate(on);
        res.json({ success: true });
      })
    );
    const testEmail = (req: Request) => {
      const email = normalizeEmail(bodyOf(req).email);
      if (!email) throw bad('email is required.');
      return email;
    };
    // Clears the limits so account tests start clean: all of them, only the named windows for one email,
    // or (allData) every account and offer too.
    r.post(
      '/api/test/account-limits-reset',
      wrap(async (req, res) => {
        const { email, scopes, allData } = bodyOf(req);
        await accountTestHelpers.resetLimits({
          email: typeof email === 'string' ? email : undefined,
          scopes: Array.isArray(scopes) ? scopes.map(String) : undefined,
          allData: allData === true,
        });
        res.json({ success: true });
      })
    );
    r.post(
      '/api/test/account-row',
      wrap(async (req, res) => {
        res.json(await accountTestHelpers.row(testEmail(req)));
      })
    );
    // A fixed list of tables and no input.
    r.get(
      '/api/test/account-table-counts',
      wrap(async (_req, res) => {
        res.json(await accountTestHelpers.tableCounts());
      })
    );
    r.post(
      '/api/test/login-code-expire',
      wrap(async (req, res) => {
        await accountTestHelpers.expireCode(testEmail(req));
        res.json({ success: true });
      })
    );
    r.post(
      '/api/test/account-session-expire',
      wrap(async (req, res) => {
        await accountTestHelpers.expireSessions(testEmail(req));
        res.json({ success: true });
      })
    );
    // Reads the global account email counter; { cap } also sets the cap (null restores the default).
    r.post(
      '/api/test/account-email-cap',
      wrap(async (req, res) => {
        const { cap } = bodyOf(req);
        if (cap !== undefined && cap !== null && (!Number.isInteger(cap) || (cap as number) < 0)) throw bad('cap must be a whole number or null.');
        res.json(await accountTestHelpers.setEmailCap(cap as number | null | undefined));
      })
    );
    // Expired rows, for the bounded-purge test.
    r.post(
      '/api/test/account-seed-expired',
      wrap(async (req, res) => {
        const count = Number(bodyOf(req).count);
        if (!Number.isInteger(count) || count < 1 || count > 500) throw bad('count must be 1-500.');
        await accountTestHelpers.seedExpired(count);
        res.json({ success: true });
      })
    );
    r.post('/api/test/offer-daily-limit', (req, res) => {
      const { limit } = bodyOf(req);
      if (limit !== null && (!Number.isInteger(limit) || (limit as number) < 0)) throw bad('limit must be a whole number or null.');
      setOfferDailyLimitForTests(limit as number | null);
      res.json({ success: true });
    });
    // One recipient left as if a send was cut off mid-call.
    r.post(
      '/api/test/offer-interrupt',
      wrap(async (req, res) => {
        const { offerId } = bodyOf(req);
        if (typeof offerId !== 'string' || !UUID_RE.test(offerId)) throw bad('offerId is required.');
        await interruptOneRecipientForTests(offerId);
        res.json({ success: true });
      })
    );
  }

  return r;
}
