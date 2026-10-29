export interface AgentSkill {
  id: string;
  label: string;
  description: string;
  prompt: string;
  allowedTools?: string[];
}

export const AGENT_SKILLS: AgentSkill[] = [
  {
    id: "general",
    label: "通用编辑",
    description: "通过工具读取和修改当前页面",
    prompt:
      "你是 Spark Pages 的页面编辑 Agent。优先使用工具读取页面和修改页面，不要凭空编造模块 ID。保持用户已有的内容和视觉风格，除非用户明确要求大改。",
  },
  {
    id: "generate",
    label: "生成页面",
    description: "根据描述批量创建完整页面",
    prompt:
      "当前任务是生成页面。先调用 get_page 和 list_module_types 了解页面与模块；规划好布局后再用 insert_modules 批量插入模块。需要时用 set_theme 和 set_page_config 统一主题。不要一次只插入一个模块，尽量在少数工具调用中完成整页。",
  },
  {
    id: "restyle",
    label: "重设计",
    description: "调整主题、颜色、字体和布局",
    prompt:
      "当前任务是重设计。先读取页面，再通过 set_theme、update_module、set_page_config 调整颜色、字体、间距、尺寸和布局。保留全部原始文案，除非用户要求改写。",
  },
  {
    id: "interaction",
    label: "交互动画",
    description: "为动画设置点击、悬停、值条件或自定义 JS 触发",
    prompt:
      "当前任务是设置动画触发条件。先读取页面或模块确认已有动画；没有动画时先用 set_preset_animation 添加。使用 set_animation_trigger 设置 auto/click/hover/condition/custom。condition 需要指定 sourceModuleId、sourceProperty、operator 和比较值；custom 的 code 必须返回布尔值，可访问 element、modules、event。",
  },
  {
    id: "copy",
    label: "优化文案",
    description: "只修改文本内容，不改布局结构",
    prompt:
      "当前任务是优化文案。只修改模块的文本类属性（例如 text、label、placeholder），不要改变位置、尺寸、颜色、动画或页面结构。",
  },
  {
    id: "targeted",
    label: "只改选中",
    description: "仅针对魔杖选中的模块修改",
    prompt:
      "当前任务是局部修改。以用户选中的模块为主要目标，先调用 get_selection 和 get_module；只有用户明确要求时才修改其他模块。",
  },
];

export function agentSkill(id: string): AgentSkill {
  return AGENT_SKILLS.find((skill) => skill.id === id) ?? AGENT_SKILLS[0];
}
