import type { ButtonState, ExperienceItem, PageLike, ProfileContext } from "./types.js";
import { normalizeWhitespace, nullableText, unique } from "./text.js";

export async function extractProfileContext(page: PageLike, profileUrl: string): Promise<ProfileContext> {
  const playwrightPage = page as unknown as {
    evaluate<T, A>(fn: (arg: A) => T, arg: A): Promise<T>;
  };
  const profile = await playwrightPage.evaluate(
    (arg) => {
      const normalizeWhitespace = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
      const nullableText = (value: string | null | undefined) => {
        const normalized = normalizeWhitespace(value);
        return normalized.length > 0 ? normalized : null;
      };
      const inferButtonState = () => {
        const states = ["Connect", "Pending", "Connected", "Message", "Follow"];
        const texts = [...document.querySelectorAll("button, [role='button']")]
          .map((element) => normalizeWhitespace(element.getAttribute("aria-label") ?? element.textContent ?? ""))
          .join(" ");
        for (const state of states) {
          if (new RegExp(`\\b${state}\\b`, "i").test(texts)) return state;
        }
        return "Unknown";
      };
      const heading = nullableText(document.querySelector("h1")?.textContent);
      const rawVisibleText = normalizeWhitespace(document.body.textContent ?? "");
      const headline = nullableText(document.querySelector("[data-test-profile-headline], .text-body-medium")?.textContent);
      const location = nullableText(document.querySelector("[data-test-profile-location]")?.textContent);
      return {
        name: heading ?? "Unknown",
        profileUrl: arg.profileUrl,
        headline,
        location,
        currentCompany: null,
        about: nullableText(document.querySelector("#about p, section:has(h2) p")?.textContent),
        experience: [...document.querySelectorAll("[data-test-experience-item], #experience li")]
          .slice(0, 3)
          .map((item) => ({
            title: nullableText(item.querySelector("h3, [data-test-title]")?.textContent),
            company: nullableText(item.querySelector("[data-test-company]")?.textContent),
            dateRange: nullableText(item.querySelector("[data-test-date-range]")?.textContent),
            description: nullableText(item.querySelector("p")?.textContent)
          })),
        skills: [...document.querySelectorAll("#skills span, [data-test-skill]")]
          .map((skill) => normalizeWhitespace(skill.textContent ?? ""))
          .filter(Boolean),
        certifications: [...document.querySelectorAll("#certifications span, [data-test-certification]")]
          .map((cert) => normalizeWhitespace(cert.textContent ?? ""))
          .filter(Boolean),
        recentActivity: [...document.querySelectorAll("#activity article, [data-test-activity]")]
          .slice(0, 2)
          .map((activity) => normalizeWhitespace(activity.textContent ?? ""))
          .filter(Boolean),
        visibleConnectState: inferButtonState(),
        rawVisibleText
      };
    },
    { profileUrl }
  );
  return {
    ...profile,
    visibleConnectState: toButtonState(profile.visibleConnectState)
  };
}

export function extractProfileContextFromDocument(document: Document, profileUrl: string): ProfileContext {
  const name = nullableText(document.querySelector("h1")?.textContent) ?? "Unknown";
  const headline = nullableText(document.querySelector("[data-test-profile-headline], .text-body-medium")?.textContent);
  const location = nullableText(document.querySelector("[data-test-profile-location]")?.textContent);
  const experience = [...document.querySelectorAll("[data-test-experience-item], #experience li")]
    .slice(0, 3)
    .map<ExperienceItem>((item) => ({
      title: nullableText(item.querySelector("h3, [data-test-title]")?.textContent),
      company: nullableText(item.querySelector("[data-test-company]")?.textContent),
      dateRange: nullableText(item.querySelector("[data-test-date-range]")?.textContent),
      description: nullableText(item.querySelector("p")?.textContent)
    }));

  return {
    name,
    profileUrl,
    headline,
    location,
    currentCompany: experience[0]?.company ?? null,
    about: extractSectionText(document, "about"),
    experience,
    skills: unique(extractListText(document, "#skills span, [data-test-skill]")),
    certifications: unique(extractListText(document, "#certifications span, [data-test-certification]")),
    recentActivity: extractListText(document, "#activity article, [data-test-activity]").slice(0, 2),
    visibleConnectState: inferButtonState(document),
    rawVisibleText: normalizeWhitespace(document.body.textContent ?? "")
  };
}

function extractSectionText(document: Document, id: string): string | null {
  const section = document.querySelector(`#${id}`);
  if (!section) return null;
  const heading = section.querySelector("h2")?.textContent ?? "";
  return nullableText(normalizeWhitespace((section.textContent ?? "").replace(heading, "")));
}

function extractListText(document: Document, selector: string): string[] {
  return [...document.querySelectorAll(selector)].map((item) => normalizeWhitespace(item.textContent ?? "")).filter(Boolean);
}

function inferButtonState(document: Document): ButtonState {
  const states: ButtonState[] = ["Connect", "Pending", "Connected", "Message", "Follow"];
  const texts = [...document.querySelectorAll("button, [role='button']")]
    .map((element) => normalizeWhitespace(element.getAttribute("aria-label") ?? element.textContent ?? ""))
    .join(" ");

  for (const state of states) {
    if (new RegExp(`\\b${state}\\b`, "i").test(texts)) return state;
  }

  return "Unknown";
}

function toButtonState(value: string): ButtonState {
  const states: ButtonState[] = ["Connect", "Pending", "Connected", "Message", "Follow", "Unknown"];
  return states.includes(value as ButtonState) ? (value as ButtonState) : "Unknown";
}
