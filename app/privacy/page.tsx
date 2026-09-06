import type { Metadata } from "next"

import { LegalPage } from "@/components/shared/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy | CreatorHub",
  description: "How CreatorHub collects, uses, and protects information.",
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="September 7, 2026">
      <section>
        <h2>About CreatorHub</h2>
        <p>
          CreatorHub helps users upload a video and publish it to social platforms they choose.
          This policy explains what information CreatorHub processes when you use the service.
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>Account information, including your email address, name, and profile image.</li>
          <li>Videos, captions, titles, hashtags, schedules, and publishing preferences you provide.</li>
          <li>Identifiers and access tokens for social accounts you connect, including YouTube, Facebook, and Instagram.</li>
          <li>Basic technical and diagnostic information needed to operate and secure the service.</li>
        </ul>
      </section>

      <section>
        <h2>How we use information</h2>
        <p>
          We use this information to authenticate you, store drafts, display connected accounts,
          publish content at your request, maintain the service, prevent misuse, and troubleshoot errors.
          We do not sell your personal information.
        </p>
      </section>

      <section>
        <h2>Connected platforms</h2>
        <p>
          When you connect a platform, CreatorHub receives only the permissions you approve. We use
          those permissions to identify the connected account and publish content you select. Your use
          of each connected platform is also governed by that platform&apos;s terms and privacy policy.
          You may revoke access in CreatorHub or in the connected platform&apos;s account settings.
        </p>
      </section>

      <section>
        <h2>Storage and service providers</h2>
        <p>
          CreatorHub uses service providers for authentication, application hosting, database storage,
          and video storage. Information may be processed in countries where these providers operate.
          We keep information only as long as needed to provide the service, meet legal obligations,
          resolve disputes, and protect the service.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          We use reasonable technical and organizational safeguards, including restricted access and
          encrypted storage for platform credentials. No online service can guarantee absolute security.
        </p>
      </section>

      <section>
        <h2>Your choices and deletion</h2>
        <p>
          You may disconnect a social account at any time. To request deletion of your CreatorHub account
          and associated data, follow our <a href="/data-deletion">Data Deletion Instructions</a>.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>CreatorHub is not intended for children under 13, and we do not knowingly collect their personal information.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update this policy as the service changes. The effective date above identifies the latest
          version. Questions may be sent to <a href="mailto:limhari11.11@gmail.com">limhari11.11@gmail.com</a>.
        </p>
      </section>
    </LegalPage>
  )
}
