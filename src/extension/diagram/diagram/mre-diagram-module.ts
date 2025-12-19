import {
	ConsoleLogger,
	ContainerConfiguration,
	ContainerManager,
	Disposable,
	EnableDefaultToolsAction,
	InsertIndicator,
	InsertIndicatorView,
	LogLevel,
	NodeCreationTool,
	NodeCreationToolMouseListener,
	RoundedCornerNodeView,
	TYPES,
	configureActionHandler,
	configureDefaultModelElements,
	elementTemplateModule,
	initializeDiagramContainer,
	nodeCreationToolModule,
} from '@eclipse-glsp/client'
import {
	Action,
	bindAsService,
	configureModelElement,
	DefaultTypes,
	DisposableCollection,
	editLabelFeature,
	FeatureModule,
	GhostElement,
	GLabel,
	GLabelView,
	GModelElement,
	GNode,
	SetModelAction,
	TriggerNodeCreationAction,
	UpdateModelAction,
} from '@eclipse-glsp/sprotty'
import 'balloon-css/balloon.min.css'
import { Container, ContainerModule, injectable } from 'inversify'
import { ReloadModelActionHandler } from './actions/reload-model-action-handler.js'
import { ReloadModelAction } from './actions/reload-model-action.js'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const mreDiagramModule = new ContainerModule((bind: any, unbind: any, isBound: any, rebind: any) => {
	rebind(TYPES.ILogger).to(ConsoleLogger).inSingletonScope()
	rebind(TYPES.LogLevel).toConstantValue(LogLevel.warn)
	const context = { bind, unbind, isBound, rebind }
	configureDefaultModelElements(context)

	bind(ReloadModelActionHandler).toSelf().inSingletonScope()
	configureActionHandler(context, ReloadModelAction.KIND, ReloadModelActionHandler)
	configureActionHandler(context, SetModelAction.KIND, ReloadModelActionHandler)
	configureActionHandler(context, UpdateModelAction.KIND, ReloadModelActionHandler)

	configureModelElement(context, 'node:entry', GNode, RoundedCornerNodeView)
	configureModelElement(context, DefaultTypes.LABEL, GLabel, GLabelView, { enable: [editLabelFeature] })
})

export function initializeMREDiagramContainer(container: Container, ...containerConfiguration: ContainerConfiguration): Container {
	return initializeDiagramContainer(container, mreDiagramModule, ...containerConfiguration)
}


export const myNodeCreationToolModule = new FeatureModule(
	(bind, unbind, isBound, rebind) => {
		const context = { bind, unbind, isBound, rebind }
		bindAsService(context, TYPES.IContainerManager, ContainerManager)
		bindAsService(context, TYPES.ITool, MyNodeCreationTool)
		configureActionHandler(context, TriggerNodeCreationAction.KIND, MyNodeCreationTool)
		configureModelElement(context, InsertIndicator.TYPE, InsertIndicator, InsertIndicatorView)
	},
	{
		featureId: nodeCreationToolModule.featureId,
		requires: elementTemplateModule,
	},
)

@injectable()
export class MyNodeCreationTool extends NodeCreationTool {
	protected override createNodeCreationListener(ghostElement: GhostElement): Disposable {
		const toolListener = new MyNodeCreationToolMouseListener(this.triggerAction, this, ghostElement)
		return new DisposableCollection(toolListener, this.mouseTool.registerListener(toolListener))
	}
}

export class MyNodeCreationToolMouseListener extends NodeCreationToolMouseListener {
	constructor(
		protected override triggerAction: TriggerNodeCreationAction,
		protected override tool: NodeCreationTool,
		protected override ghostElement: GhostElement,
	) {
		super(triggerAction, tool, ghostElement)
		this._dragSensitivity = 100
	}

	override nonDraggingMouseUp(ctx: GModelElement, event: MouseEvent): Action[] {
		const result: Action[] = []

		const insert = this.getTrackedInsert(ctx, event)
		if (insert.valid) {
			result.push(this.getCreateOperation(ctx, event, insert))
		}
		if (this.isContinuousMode(ctx, event)) {
			// we continue in stamp mode so we keep the ghost but dispose everything else
			this.disposeAllButGhostElement()
			return result
		}

		this.dispose()

		result.push(EnableDefaultToolsAction.create())
		return result
	}
}