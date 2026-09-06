import type { Metadata } from "next"

import { LegalPage } from "@/components/shared/legal-page"

export const metadata: Metadata = {
  title: "Data Deletion Instructions | CreatorHub",
  description: "How to disconnect platforms and request deletion of CreatorHub data.",
}

export default function DataDeletionPage() {
  return (
    <LegalPage title="Data Deletion Instructions" effectiveDate="September 7, 2026">
      <section>
        <h2>Disconnect a platform</h2>
        <p>
          Sign in to CreatorHub, open <strong>Connected Accounts</strong>, and select <strong>Disconnect</strong>
          next to the relevant account or Page. This removes CreatorHub&apos;s stored connection for that account.
          You can also revoke CreatorHub directly from the connected platform&apos;s Apps and Websites or security settings.
        </p>
      </section>

      <section>
        <h2>Request complete deletion</h2>
        <p>
          Email <a href="mailto:limhari11.11@gmail.com?subject=CreatorHub%20data%20deletion%20request">limhari11.11@gmail.com</a>
          from the email address associated with your CreatorHub account. Use the subject
          <strong> CreatorHub data deletion request</strong> and identify the connected accounts you want deleted.
        </p>
        <p>
          We may ask you to confirm account ownership. After verification, we will delete or anonymize the
          associated CreatorHub profile, drafts, stored videos, publishing settings, and connected-platform
          credentials, except information that must be retained for security or legal obligations. We aim to
          complete verified requests within 30 days and will confirm when the request is complete.
        </p>
      </section>

      <section>
        <h2>Facebook and Instagram data</h2>
        <p>
          Removing CreatorHub from Facebook or Instagram stops future access. Content already published to a
          Facebook Page or Instagram account remains on that platform until you delete it there.
        </p>
      </section>
    </LegalPage>
  )
}
