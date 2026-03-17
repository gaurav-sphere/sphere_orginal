import { createBrowserRouter } from "react-router";
import { GuestHomePage }        from "../pages/GuestHomePage";
import { CategoryPage }         from "../pages/CategoryPage";
import { GuestPostPage }        from "../pages/GuestPostPage";
import { GuestSearchPage }      from "../pages/GuestSearchPage";
import { QuotePage }            from "../pages/QuotePage";
import { MediaPage }            from "../pages/MediaPage";
import { LoggedInSearchPage }   from "../pages/LoggedInSearchPage";
import { LoginPage }            from "../pages/LoginPage";
import { CategorySelectionPage } from "../pages/CategorySelectionPage";
import { FeedPage }             from "../pages/FeedPage";
import { CreatePostPage }       from "../pages/CreatePostPage";
import { ProfilePage }          from "../pages/ProfilePage";
import { UserProfilePage }      from "../pages/UserProfilePage";
import { LoginPostPage }        from "../pages/LoginPostPage";
import { MessagesPage }         from "../pages/MessagesPage";
import { StatusPage }           from "../pages/StatusPage";
import { EditProfilePage }      from "../pages/EditProfilePage";
import { FollowersPage }        from "../pages/FollowersPage";
import { SettingsPage }         from "../pages/SettingsPage";
import { AccountInfoPage }      from "../pages/AccountInfoPage";
import { BlockedListPage }      from "../pages/BlockedListPage";
import { MessageSettingsPage }  from "../pages/MessageSettingsPage";
import { ReportPostPage }       from "../pages/ReportPostPage";
import { ForgotPasswordPage }   from "../pages/ForgotPasswordPage";
import { AnonPinPage } from "../pages/AnonPinPage"
import { NotificationsPage }      from "../pages/NotificationsPage";

export const router = createBrowserRouter([
  /* ── Guest routes ── */
  { path: "/",                          Component: GuestHomePage },
  { path: "/category/:id",              Component: CategoryPage },
  { path: "/search",                    Component: GuestSearchPage },

  /* ── Canonical quote URL (smart — guest or logged-in) ── */
  { path: "/quote/:id",                 Component: QuotePage },

  /* ── Media viewer ── */
  { path: "/media/:postId/:index",      Component: MediaPage },

  /* ── Auth ── */
  { path: "/login",                     Component: LoginPage },
  { path: "/forgot-password",           Component: ForgotPasswordPage },

  /* ── Logged-in routes ── */
  { path: "/categories",                Component: CategorySelectionPage },
  { path: "/feed",                      Component: FeedPage },
  { path: "/feed/search",               Component: LoggedInSearchPage },
  { path: "/create-post",               Component: CreatePostPage },
  { path: "/profile",                   Component: ProfilePage },
  { path: "/profile/edit",              Component: EditProfilePage },
  { path: "/profile/followers/:userId", Component: FollowersPage },
  { path: "/user/:userId",              Component: UserProfilePage },
  { path: "/user/:userId/followers",    Component: FollowersPage },
  { path: "/thoughts/:id",              Component: LoginPostPage }, // legacy redirect
  { path: "/post/:id",                  Component: GuestPostPage }, // legacy redirect
  { path: "/report/:id",                Component: ReportPostPage },
  { path: "/messages",                  Component: MessagesPage },
  { path: "/messages/blocked",          Component: BlockedListPage },
  { path: "/messages/settings",         Component: MessageSettingsPage },
  { path: "/status",                    Component: StatusPage },
  { path: "/status/:userId",            Component: StatusPage },
  { path: "/settings",                  Component: SettingsPage },
  { path: "/settings/account-info",     Component: AccountInfoPage },
  { path: "/settings/anon-pin",         Component: AnonPinPage },
  { path: "/notifications",             Component: NotificationsPage },
]);
