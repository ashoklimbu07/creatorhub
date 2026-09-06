import type { Metadata } from "next"

import { LegalPage } from "@/components/shared/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service | CreatorHub",
  description: "Terms governing use of CreatorHub.",
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="September 7, 2026">
      <section>
        <h2>Acceptance</h2>
        <p>By using CreatorHub, you agree to these terms. If you do not agree, do not use the service.</p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You are responsible for your account, the accuracy of information you provide, and activity
          performed through your account. Keep your login credentials secure and notify us of suspected unauthorized access.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You retain ownership of content you upload. You give CreatorHub the limited permission needed
          to store, process, and send that content to platforms you select. You confirm that you have all
          rights needed to publish the content and that it complies with applicable laws and platform rules.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not use CreatorHub to violate laws, intellectual-property rights, privacy rights, platform
          policies, or the rights of others. Do not interfere with the service, bypass access controls,
          distribute malware, or attempt unauthorized access.
        </p>
      </section>

      <section>
        <h2>Third-party platforms</h2>
        <p>
          CreatorHub connects with third-party services such as Google, YouTube, Facebook, and Instagram.
          Their availability, review decisions, API limits, and policies are outside our control. Your use
          of those services remains subject to their own terms.
        </p>
      </section>

      <section>
        <h2>Service availability</h2>
        <p>
          This service is provided on an as-available basis. Features may change or stop, and scheduled
          publishing may fail because of network errors, platform outages, expired permissions, or rejected content.
          Review the destination platform after publishing important content.
        </p>
      </section>

      <section>
        <h2>Termination and deletion</h2>
        <p>
          You may stop using CreatorHub and disconnect connected accounts at any time. We may suspend access
          when reasonably necessary to protect the service or address violations. Data deletion requests are
          handled as described in our <a href="/data-deletion">Data Deletion Instructions</a>.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about these terms may be sent to <a href="mailto:limhari11.11@gmail.com">limhari11.11@gmail.com</a>.</p>
      </section>
    </LegalPage>
  )
}
