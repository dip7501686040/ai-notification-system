import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type Profile, type VerifyCallback } from "passport-google-oauth20";
import { env } from "../../env";

export interface GoogleOAuthUser {
  email: string;
  name?: string;
  provider: "google";
  providerId: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    super({
      clientID: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: env.GOOGLE_CALLBACK_URL as string,
      scope: ["email", "profile"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error("Google account has no email"));
      return;
    }

    const user: GoogleOAuthUser = {
      email,
      name: profile.displayName,
      provider: "google",
      providerId: profile.id,
    };
    done(null, user);
  }
}
