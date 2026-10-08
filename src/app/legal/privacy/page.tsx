import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/legal-layout'
import {
  LEGAL_CONTACT_EMAIL, LEGAL_ENTITY_NAME, PRIVACY_EFFECTIVE_DATE, PRIVACY_VERSION,
} from '@/lib/legal'

export const metadata: Metadata = { title: 'Privacy Policy | Benchtop' }

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" version={PRIVACY_VERSION} effectiveDate={PRIVACY_EFFECTIVE_DATE}>
      <section>
        <h2>1. Who is responsible</h2>
        <p>
          {LEGAL_ENTITY_NAME} (&quot;we&quot;) operates Benchtop and is responsible for the personal data described here.
          Contact: {LEGAL_CONTACT_EMAIL}.
        </p>
      </section>

      <section>
        <h2>2. What we collect</h2>
        <ul>
          <li><strong>Account and profile:</strong> your email address, password (stored only as a salted hash by our authentication provider), full name, company, job title, phone number and time zone (the last four are optional), and the versions and times at which you accepted the Terms and this Policy.</li>
          <li><strong>Workspace content you create:</strong> projects, formulations, ingredient and nutrient data, inventory and stock levels, suppliers, equipment, process steps, batch records, and any documents, photos or labels you upload.</li>
          <li><strong>Billing:</strong> handled by Stripe. We store a Stripe customer ID and your subscription status, plan and renewal date. Your card number never reaches Benchtop.</li>
          <li><strong>Technical data:</strong> session cookies needed to keep you signed in, and server logs.</li>
        </ul>
      </section>

      <section>
        <h2>3. How we use it</h2>
        <p>
          To provide and secure the service, authenticate you, process your subscription, let you export or delete your
          data, and communicate with you about your account. We do not sell personal data. TODO: confirm with the
          operator and the AI provider&apos;s terms what is stated here about use of content for model training.
        </p>
      </section>

      <section>
        <h2>4. Tenant isolation</h2>
        <p>
          Every account is a separate workspace. Access to workspace data is restricted to the members of that account,
          and data is never shared between accounts, including inventory, suppliers, ingredients and uploaded documents.
        </p>
      </section>

      <section>
        <h2>5. Service providers (processors)</h2>
        <ul>
          <li><strong>Supabase</strong> &ndash; database hosting, authentication and file storage for uploaded documents.</li>
          <li><strong>Stripe</strong> &ndash; payment processing and subscription management.</li>
          <li><strong>Anthropic</strong> &ndash; AI processing when you use features such as label and photo parsing, document parsing and formulation research. The content you submit to those features (for example an image or PDF, or ingredient and nutrition text) is sent to Anthropic to produce the result.</li>
          <li><strong>USDA FoodData Central</strong> &ndash; nutrient lookups. Search terms and food IDs you request are sent to the USDA service.</li>
          <li><strong>Brave Search</strong> &ndash; web lookups. Search queries you submit are sent to Brave.</li>
        </ul>
      </section>

      <section>
        <h2>6. Your rights and controls</h2>
        <ul>
          <li><strong>Access and portability:</strong> Settings &rarr; Privacy &amp; Terms &rarr; Download my data gives you a JSON export of your account&apos;s data.</li>
          <li><strong>Correction:</strong> edit your profile and account details in Settings.</li>
          <li><strong>Deletion:</strong> Settings &rarr; Privacy &amp; Terms &rarr; Delete account permanently removes your account&apos;s data, uploaded documents and your login, and cancels your subscription.</li>
          <li>You may also contact us at {LEGAL_CONTACT_EMAIL} to exercise these rights.</li>
        </ul>
      </section>

      <section>
        <h2>7. Retention</h2>
        <p>
          We keep your data while your account exists. When you delete your account, its workspace data, documents,
          profile and login are deleted. Records that payment processors or the law require them to keep (for example
          invoices held by Stripe) are retained by those parties under their own policies. Backups may retain deleted data
          for a limited period before they are overwritten.
        </p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>
          We use access controls, encrypted connections and per-account data separation. No system is perfectly secure,
          so please use a strong, unique password.
        </p>
      </section>

      <section>
        <h2>9. International transfers</h2>
        <p>
          Our service providers may process data in countries other than your own. Where required we rely on appropriate
          safeguards. TODO: confirm hosting regions and transfer mechanisms.
        </p>
      </section>

      <section>
        <h2>10. Changes</h2>
        <p>
          We may update this Policy. The version and effective date above identify the current text, and we will notify
          you of material changes.
        </p>
      </section>
    </LegalLayout>
  )
}
