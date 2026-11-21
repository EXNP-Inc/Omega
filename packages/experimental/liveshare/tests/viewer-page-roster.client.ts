/**
 * Test-only client roster of the assembled viewer page.
 *
 * A served viewer page is the owner's own Web shell with the owner's client plugins; this roster is the
 * subset the viewer page specs need: the wire plugin, the Gateway, remote access, the Session/Workspace controllers,
 * Session status, the menu service, presentation plugins, and the Liveshare `./client` face, which mounts the viewer
 * surfaces when the carrier names a share. Every row is the package's own `/client` face registered as a module-table
 * factory. It must be imported only after {@link prepareViewerRemoteFaces} answered the generated
 * `/remote` faces these plugins import.
 *
 * @module @omega-ai/dsh-experimental-liveshare/tests/viewer-page-roster
 */

import * as apiGateway from '@omega-ai/dsh-api-gateway/client'
import * as apiRemoteAccess from '@omega-ai/dsh-api-remote-access/client'
import * as apiRemotes from '@omega-ai/dsh-api-remotes/client'
import * as apiSessionController from '@omega-ai/dsh-api-session-controller/client'
import * as apiWorkspaceController from '@omega-ai/dsh-api-workspace-controller/client'
import * as clientConnection from '@omega-ai/dsh-client-connection/client'
import * as clientFileUpload from '@omega-ai/dsh-client-file-upload/client'
import * as clientLocale from '@omega-ai/dsh-client-locale/client'
import * as clientModules from '@omega-ai/dsh-client-modules/client'
import * as clientResources from '@omega-ai/dsh-client-resources/client'
import * as clientShortcuts from '@omega-ai/dsh-client-shortcuts/client'
import * as uiAttachment from '@omega-ai/dsh-client-ui-attachment/client'
import * as uiChat from '@omega-ai/dsh-client-ui-chat/client'
import * as uiContextMenu from '@omega-ai/dsh-client-ui-context-menu/client'
import * as uiConversation from '@omega-ai/dsh-client-ui-conversation/client'
import * as uiDeliverables from '@omega-ai/dsh-client-ui-deliverables/client'
import * as uiFileDrag from '@omega-ai/dsh-client-ui-file-drag/client'
import * as uiLayout from '@omega-ai/dsh-client-ui-layout/client'
import * as uiRenderer from '@omega-ai/dsh-client-ui-renderer/client'
import * as uiSession from '@omega-ai/dsh-client-ui-session/client'
import * as uiSessionStatus from '@omega-ai/dsh-client-ui-session-status/client'
import * as uiSettings from '@omega-ai/dsh-client-ui-settings/client'
import * as uiSidebar from '@omega-ai/dsh-client-ui-sidebar/client'
import * as uiSidebarRight from '@omega-ai/dsh-client-ui-sidebar-right/client'
import * as uiTheme from '@omega-ai/dsh-client-ui-theme/client'
import * as uiTool from '@omega-ai/dsh-client-ui-tool/client'
import * as uiTrajectory from '@omega-ai/dsh-client-ui-trajectory/client'
import * as uiWorkspace from '@omega-ai/dsh-client-ui-workspace/client'
import * as typertRegistry from '@omega-ai/dsh-typert-registry/client'
import * as liveshare from '../src/client/index.ts'

/** One module-table row: the entry id the Loader creates, and that plugin's client exports. */
export interface ViewerPageRosterRow {
  readonly id: string
  readonly exports: Readonly<Record<string, unknown>>
}

/** Entry id of the module-system bootstrap whose exports the facade hands to the module system. */
export const VIEWER_PAGE_BOOTSTRAP_ID = '@omega-ai/dsh-client-modules'

/** The viewer page roster; Cordis composes these entries by service injection, so order is irrelevant. */
export const VIEWER_PAGE_ROSTER: readonly ViewerPageRosterRow[] = [
  { id: '@omega-ai/dsh-typert-registry', exports: typertRegistry },
  { id: '@omega-ai/dsh-experimental-liveshare', exports: liveshare },
  { id: VIEWER_PAGE_BOOTSTRAP_ID, exports: clientModules },
  { id: '@omega-ai/dsh-client-connection', exports: clientConnection },
  { id: '@omega-ai/dsh-api-gateway', exports: apiGateway },
  { id: '@omega-ai/dsh-api-remote-access', exports: apiRemoteAccess },
  { id: '@omega-ai/dsh-api-remotes', exports: apiRemotes },
  { id: '@omega-ai/dsh-api-session-controller', exports: apiSessionController },
  { id: '@omega-ai/dsh-api-workspace-controller', exports: apiWorkspaceController },
  { id: '@omega-ai/dsh-client-file-upload', exports: clientFileUpload },
  { id: '@omega-ai/dsh-client-locale', exports: clientLocale },
  { id: '@omega-ai/dsh-client-resources', exports: clientResources },
  { id: '@omega-ai/dsh-client-shortcuts', exports: clientShortcuts },
  { id: '@omega-ai/dsh-client-ui-renderer', exports: uiRenderer },
  { id: '@omega-ai/dsh-client-ui-theme', exports: uiTheme },
  { id: '@omega-ai/dsh-client-ui-settings', exports: uiSettings },
  { id: '@omega-ai/dsh-client-ui-layout', exports: uiLayout },
  { id: '@omega-ai/dsh-client-ui-session', exports: uiSession },
  { id: '@omega-ai/dsh-client-ui-session-status', exports: uiSessionStatus },
  { id: '@omega-ai/dsh-client-ui-sidebar', exports: uiSidebar },
  { id: '@omega-ai/dsh-client-ui-conversation', exports: uiConversation },
  { id: '@omega-ai/dsh-client-ui-chat', exports: uiChat },
  { id: '@omega-ai/dsh-client-ui-context-menu', exports: uiContextMenu },
  { id: '@omega-ai/dsh-client-ui-tool', exports: uiTool },
  { id: '@omega-ai/dsh-client-ui-attachment', exports: uiAttachment },
  { id: '@omega-ai/dsh-client-ui-file-drag', exports: uiFileDrag },
  { id: '@omega-ai/dsh-client-ui-sidebar-right', exports: uiSidebarRight },
  { id: '@omega-ai/dsh-client-ui-trajectory', exports: uiTrajectory },
  { id: '@omega-ai/dsh-client-ui-deliverables', exports: uiDeliverables },
  { id: '@omega-ai/dsh-client-ui-workspace', exports: uiWorkspace },
]
