import { ExternalIntegrationError } from '@/lib/http/errors';
import { requireEnv } from '@/lib/env';

type StripeCheckoutMode = 'payment' | 'subscription';

type StripeCheckoutRequest = {
  success_url: string;
  cancel_url: string;
  mode: StripeCheckoutMode;
  customer: string;
  line_items: Array<{ price: string; quantity: number }>;
  client_reference_id?: string;
  metadata?: Record<string, string>;
  subscription_data?: {
    trial_period_days?: number;
    metadata?: Record<string, string>;
  };
};

type StripeCustomerRequest = {
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
};

type StripeCustomerResponse = { id: string };

type StripeCheckoutResponse = { id: string; url: string | null };

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function formEncode(data: Record<string, string | number | undefined | null>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    body.append(key, String(value));
  }
  return body;
}

async function stripeRequest<T>(path: string, body: URLSearchParams): Promise<T> {
  const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new ExternalIntegrationError('Stripe request failed', {
      status: response.status,
      statusText: response.statusText,
      error: data,
    });
  }

  return data as T;
}

export function getStripeServerClient() {
  return {
    async createCustomer(input: StripeCustomerRequest): Promise<StripeCustomerResponse> {
      const body = formEncode({
        email: input.email,
        name: input.name,
      });

      if (input.metadata) {
        for (const [key, value] of Object.entries(input.metadata)) {
          body.append(`metadata[${key}]`, value);
        }
      }

      return stripeRequest<StripeCustomerResponse>('/customers', body);
    },

    async createCheckoutSession(input: StripeCheckoutRequest): Promise<StripeCheckoutResponse> {
      const body = formEncode({
        success_url: input.success_url,
        cancel_url: input.cancel_url,
        mode: input.mode,
        customer: input.customer,
        client_reference_id: input.client_reference_id,
      });

      input.line_items.forEach((item, index) => {
        body.append(`line_items[${index}][price]`, item.price);
        body.append(`line_items[${index}][quantity]`, item.quantity.toString());
      });

      if (input.metadata) {
        for (const [key, value] of Object.entries(input.metadata)) {
          body.append(`metadata[${key}]`, value);
        }
      }

      if (input.subscription_data?.metadata) {
        for (const [key, value] of Object.entries(input.subscription_data.metadata)) {
          body.append(`subscription_data[metadata][${key}]`, value);
        }
      }

      if (typeof input.subscription_data?.trial_period_days === 'number') {
        body.append('subscription_data[trial_period_days]', input.subscription_data.trial_period_days.toString());
      }

      return stripeRequest<StripeCheckoutResponse>('/checkout/sessions', body);
    },
  };
}
