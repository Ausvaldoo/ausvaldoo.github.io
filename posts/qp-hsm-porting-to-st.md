---
title: 把 C 语言 QP 框架的层次状态机移植到 PLC 的 ST 语言
tags:
  - PLC
  - ST
  - QP
  - 状态机
  - IEC61131-3
categories: 工业自动化
description: >-
  QP 的核心是层次状态机与事件驱动。移植到 ST 要跨过三道坎：函数指针、状态嵌套、事件队列。这里给出三种落地方案与各自的代价。
date: 2026-09-06 12:10:00
---

## 要解决的问题

QP（Quantum Platform）的核心是一个层次状态机框架。在 C 里，状态被表达为函数，事件通过函数指针分发，子状态处理不了的事件会自动冒泡给父状态：

```c
QState Motor_run(Motor * const me, QEvt const * const e) {
    switch (e->sig) {
        case Q_ENTRY_SIG:
            PWM_Start();
            return Q_RET_HANDLED;
        case Q_EXIT_SIG:
            PWM_Stop();
            return Q_RET_HANDLED;
        case STOP_SIG:
            return Q_TRAN(&Motor_idle);   // 状态转移
    }
    return Q_SUPER(&QHsm_top);            // 未处理 → 冒泡给父状态
}
```

这套机制的优雅之处在于：**层次嵌套**（子状态继承父状态的行为）、**进入/退出动作**（entry/exit 保证资源配对）、**事件队列**（异步解耦）。

把这套东西搬到 IEC 61131-3 的 ST 上，要跨过三道坎：

1. **函数指针** — 经典 ST 没有函数指针（IEC 61131-3 第三版虽引入引用，但支持度参差）
2. **状态嵌套** — 需要在没有类继承语义的情况下表达父/子状态
3. **事件队列** — QP 的多优先级队列要在一个扫描周期内正确批处理

## 三种方案与代价

| 方案 | 核心做法 | 嵌套支持 | 可移植性 | 维护成本 |
|---|---|---|---|---|
| A. CASE + 状态字 | 单层 `CASE` 分支，父状态逻辑手工下沉到每个子分支 | 弱（靠复制） | 最高，任何 PLC 都能跑 | 状态多时爆炸 |
| B. FB 实例数组 + 索引跳转 | 每个状态一个函数块，用索引数组查表分发 | 中（显式调用父 FB） | 高，需支持 FB 数组 | 中 |
| C. ST 的 OOP 特性 | 用 FB 的方法、继承、`INTERFACE` 直接映射 HSM 语义 | 强（原生继承） | 低，依赖 CODESYS 等支持 OOP 的平台 | 最低 |

### 方案 A：CASE + 状态字（最保守）

```pascal
CASE eState OF
    ST_IDLE:
        IF bStart THEN
            PWM_Start();
            eState := ST_RUN;
        END_IF;
    ST_RUN:
        IF bStop THEN
            PWM_Stop();
            eState := ST_IDLE;
        END_IF;
END_CASE;
```

优点：零依赖，任何一个能跑 ST 的 PLC 都认。缺点：状态超过 10 个、且有层次时，父状态的公共逻辑要在每个子分支里重复写一遍，改一处要改 N 处。适合简单设备。

### 方案 B：FB 实例数组 + 索引分发

把每个状态做成一个函数块，暴露 `OnEntry` / `OnExit` / `OnEvent` 三个方法，主循环用索引查表：

```pascal
// 状态表：数组下标即状态号
aStates : ARRAY [0..MAX_STATE] OF FB_StateBase;
eCurrent : E_State;

// 分发
IF aStates[eCurrent].OnEvent(e) = NOT_HANDLED THEN
    // 冒泡到父状态，父索引由状态自己声明
    aStates[aStates[eCurrent].ParentId].OnEvent(e);
END_IF;
```

这里的关键是给每个状态 FB 加一个 `ParentId` 属性，手动实现"冒泡"。层次深度建议在编译期固定为 2–3 层，避免运行时递归（PLC 上递归是危险的）。

### 方案 C：直接用 ST 的 OOP（我倾向的方向）

IEC 61131-3 第三版给 ST 带来了 `METHOD`、`EXTENDS`、`IMPLEMENTS`、`THIS^`。这意味着可以直接把 QP 的语义搬过来：

```pascal
FUNCTION_BLOCK FB_State ABSTRACT
METHOD OnEntry : BOOL
METHOD OnExit  : BOOL
METHOD HandleEvent : INT   // 返回已处理 / 未处理 / 转移
VAR_INPUT e : ST_Event; END_VAR
```

每个具体状态 `EXTENDS FB_State`，父状态实现通用逻辑，子状态通过 `SUPER^.HandleEvent(e)` 冒泡。语义上最接近 C 版 QP，代码量也最少。

代价是**平台绑定**：CODESYS V3 系支持良好，其他平台（尤其是国产小型 PLC）对 `INTERFACE` / `SUPER^` 的支持要逐个实测。移植前先写一段最小验证程序跑一遍，别等到写完了才发现不支持。

## 事件队列怎么落地

QP 用多个优先级的环形队列。ST 上的简化实现：

```pascal
VAR
    aQueue : ARRAY [0..Q_SIZE-1] OF ST_Event;
    uiHead : UINT := 0;
    uiTail : UINT := 0;
END_VAR

// 入队（满则丢弃并计数，绝不覆盖）
IF (uiTail + 1) MOD Q_SIZE <> uiHead THEN
    aQueue[uiTail] := e;
    uiTail := (uiTail + 1) MOD Q_SIZE;
ELSE
    uiDropped := uiDropped + 1;
END_IF;
```

三个必须注意的点：

1. **队列满时绝不能覆盖头部** — 丢事件并计数报警，让上层知道发生了什么。覆盖会制造极难复现的偶发故障。
2. **一个扫描周期内要限定处理条数** — 否则事件密集时看门狗超时。建议每周期最多处理 N 条，剩余留到下一周期。
3. **事件要带时间戳** — 便于事后追溯顺序问题，代价很小。

## 还没解决的问题

老实记录当前遗留的两个坑，避免以后重复踩：

- **转移路径上的 entry/exit 顺序**：从深层子状态转移到任意目标状态时，需要先沿当前链执行 exit、再沿目标链执行 entry。目前的实现只处理了同层转移，跨层转移的路径计算还没做完整，需要求两条链的最近公共祖先（LCA）。
- **事件队列的优先级**：QP 的多级队列简化成了单队列，高优先级事件目前只能插到队头，语义不完整。

## 小结

**如果目标平台支持 OOP，用方案 C；否则用方案 B；只有在状态极少、且对可移植性要求极高时才用方案 A。** 移植的核心不是语法转换，而是想清楚"用哪种机制替代函数指针"——这个问题定了，剩下都是体力活。
