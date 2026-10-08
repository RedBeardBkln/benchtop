import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/legal-layout'
import {
  LEGAL_CONTACT_EMAIL, LEGAL_ENTITY_NAME, LEGAL_JURISDICTION, TERMS_EFFECTIVE_DATE, TERMS_VERSION,
} from '@/lib/legal'

export const metadata: Metadata = { title: 'Terms of Service | Benchtop' }

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" version={TERMS_VERSION} effectiveDate={TERMS_EFFECTIVE_DATE}>
      <section>
        <h2>1. Who we are and what these terms cover</h2>
        <p>
          Benchtop is a food formulation platform operated by {LEGAL_ENTITY_NAME} (&quot;we&quot;, &quot;us&quot;). These
          terms govern your access to and use of Benchtop. By creating an account or using the service you agree to them
          and to our Privacy Policy.
        </p>
      </section>

      <section>
        <h2>2. Invitation-only access</h2>
        <p>
          Accounts are created by invitation only. An invitation link is personal to the email address it was issued for,
          expires after a limited time, and can be used once. You must not share your invitation link or your sign-in
          credentials.
        </p>
      </section>

      <section>
        <h2>3. Your account and your data</h2>
        <ul>
          <li>Each account is a private workspace. Your projects, formulations, ingredients, inventory, suppliers, equipment and documents are not visible to other accounts.</li>
          <li>You keep ownership of everything you put into Benchtop. You grant us only the limited permission needed to store, process and display it to you in order to run the service.</li>
          <li>You are responsible for the accuracy of your data and for how you use the results. Benchtop assists with formulation and labelling work; it does not replace regulatory, safety or quality review.</li>
          <li>You can export your data and delete your account from Settings at any time.</li>
        </ul>
      </section>

      <section>
        <h2>4. Subscription, renewal and cancellation</h2>
        <ul>
          <li>Access to Benchtop requires an active paid subscription, billed through our payment processor, Stripe. Card details are handled by Stripe and never touch Benchtop.</li>
          <li>Subscriptions renew automatically for the same billing period until cancelled. You can cancel, update your payment method and view invoices at any time from Settings &rarr; Billing (Manage billing).</li>
          <li>If you cancel, you keep access until the end of the period you have paid for. If a payment fails we may retry it and may suspend access if it remains unpaid.</li>
          <li>Fees already paid are non-refundable except where required by law.</li>
        </ul>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>attempt to access another account&apos;s data or to bypass the service&apos;s access controls;</li>
          <li>reverse engineer, scrape or overload the service, or use it to build a competing product;</li>
          <li>upload unlawful content or content you do not have the right to use;</li>
          <li>misuse the AI-assisted features, including to generate content that infringes others&apos; rights.</li>
        </ul>
      </section>

      <section>
        <h2>6. Third-party services</h2>
        <p>
          Benchtop relies on third-party providers (for example hosting and authentication, payments, AI document and
          label parsing, and nutrient and web lookups). They are described in the Privacy Policy. Their availability and
          accuracy are outside our control.
        </p>
      </section>

      <section>
        <h2>7. Availability and disclaimers</h2>
        <p>
          The service is provided &quot;as is&quot; and &quot;as available&quot;. We do not guarantee uninterrupted or
          error-free operation, or that nutrient data, calculations or AI-extracted values are complete or correct. You
          should verify critical values before relying on them.
        </p>
      </section>

      <section>
        <h2>8. Limitation of liability</h2>
        <p>
          To the extent permitted by law, we are not liable for indirect or consequential losses, and our total liability
          for any claim is limited to the fees you paid in the 12 months before the claim. Nothing in these terms limits
          liability that cannot be limited by law.
        </p>
      </section>

      <section>
        <h2>9. Suspension and termination</h2>
        <p>
          You may stop using Benchtop and delete your account at any time. We may suspend or terminate access for breach
          of these terms, non-payment, or to protect the service or other users. On deletion your data is removed as
          described in the Privacy Policy.
        </p>
      </section>

      <section>
        <h2>10. Changes to these terms</h2>
        <p>
          We may update these terms. The version and effective date above identify the current text. Material changes
          will be communicated before they take effect.
        </p>
      </section>

      <section>
        <h2>11. Governing law and contact</h2>
        <p>
          These terms are governed by the laws of {LEGAL_JURISDICTION}. Questions: {LEGAL_CONTACT_EMAIL}.
        </p>
      </section>
    </LegalLayout>
  )
}
